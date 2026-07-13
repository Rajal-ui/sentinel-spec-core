"""adapters/ibm.py — IBM Granite dual-agent compliance engine.

Agent 1 — Sentinel Classifier:
    Accepts the target code snippet and cross-references it against the
    22-rule compliance matrix using IBM Granite via ibm-watsonx-ai SDK.

Agent 2 — Adversarial Critic:
    Intercepts Agent 1's analysis in a fully independent, zero-bias Granite
    context block. Performs strict entailment verification to eliminate false
    positives before generating the final JSON payload.

Persistence:
    Completed execution records are written to IBM Cloud Object Storage via
    the ibm-cos-sdk Python library when COS credentials are configured.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference

from domain.models import (
    AgentThinkingStep,
    ClassificationResult,
    CodeSnippet,
    ComplianceReport,
    ComplianceViolation,
    CriticVerdict,
    ExecutionRecord,
    FindingTier,
)
from ports.ai_engine_port import AIEnginePort

# ---------------------------------------------------------------------------
# IBM Granite model IDs
# ---------------------------------------------------------------------------

GRANITE_MODEL_ID = os.getenv(
    "WATSONX_MODEL_ID", "ibm/granite-4-h-small"
)

# ---------------------------------------------------------------------------
# 22-rule compliance matrix used in structured prompt context
# ---------------------------------------------------------------------------

COMPLIANCE_MATRIX: list[dict[str, str]] = [
    {"rule_id": "SEC-001", "domain": "secrets",        "name": "Hard-coded credential",        "severity": "CRITICAL"},
    {"rule_id": "SEC-002", "domain": "secrets",        "name": "API key in source",             "severity": "CRITICAL"},
    {"rule_id": "SEC-003", "domain": "injection",      "name": "SQL injection vector",          "severity": "HIGH"},
    {"rule_id": "SEC-004", "domain": "injection",      "name": "OS command injection",          "severity": "HIGH"},
    {"rule_id": "SEC-005", "domain": "injection",      "name": "Template injection",            "severity": "HIGH"},
    {"rule_id": "SEC-006", "domain": "path",           "name": "Path traversal",                "severity": "HIGH"},
    {"rule_id": "SEC-007", "domain": "path",           "name": "Unsafe file open",              "severity": "MEDIUM"},
    {"rule_id": "SEC-008", "domain": "crypto",         "name": "Weak cipher usage",             "severity": "HIGH"},
    {"rule_id": "SEC-009", "domain": "crypto",         "name": "Insecure random number",        "severity": "MEDIUM"},
    {"rule_id": "SEC-010", "domain": "auth",           "name": "Missing authentication check",  "severity": "CRITICAL"},
    {"rule_id": "SEC-011", "domain": "auth",           "name": "Broken access control",         "severity": "HIGH"},
    {"rule_id": "SEC-012", "domain": "logging",        "name": "PII logged in plaintext",       "severity": "HIGH"},
    {"rule_id": "SEC-013", "domain": "logging",        "name": "Sensitive data in stack trace", "severity": "MEDIUM"},
    {"rule_id": "ARCH-001","domain": "architecture",   "name": "Hexagonal domain leakage",      "severity": "MEDIUM"},
    {"rule_id": "ARCH-002","domain": "architecture",   "name": "Framework import in domain",    "severity": "MEDIUM"},
    {"rule_id": "ARCH-003","domain": "architecture",   "name": "Direct DB call from domain",    "severity": "HIGH"},
    {"rule_id": "ARCH-004","domain": "architecture",   "name": "Missing port abstraction",      "severity": "MEDIUM"},
    {"rule_id": "ARCH-005","domain": "data-residency", "name": "Data residency violation",      "severity": "CRITICAL"},
    {"rule_id": "ARCH-006","domain": "api-contract",   "name": "API contract drift",            "severity": "HIGH"},
    {"rule_id": "ARCH-007","domain": "api-contract",   "name": "Undocumented public endpoint",  "severity": "MEDIUM"},
    {"rule_id": "QUAL-001","domain": "quality",        "name": "Unsafe deserialization",        "severity": "HIGH"},
    {"rule_id": "QUAL-002","domain": "quality",        "name": "Unhandled exception exposure",  "severity": "MEDIUM"},
]

_MATRIX_JSON = json.dumps(COMPLIANCE_MATRIX, separators=(",", ":"))

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

CLASSIFIER_SYSTEM_PROMPT = f"""You are Sentinel — a strict policy conformance classifier trained exclusively on IBM Granite.

COMPLIANCE MATRIX (22 rules):
{_MATRIX_JSON}

Your task:
1. Analyse the provided source code snippet against EVERY rule in the compliance matrix.
2. Identify all violations present.
3. For each violation include a specific line number estimate.

Respond with ONLY a minified JSON object matching this exact schema (no markdown, no prose):
{{"violations":[{{"rule_id":"<rule_id>","severity":"<severity>","line_number":<int>,"confidence":<float 0-1>,"rationale":"<concise reason>","suggested_fix":"<actionable fix>"}}]}}

Rules:
- If no violations exist, return {{"violations":[]}}
- Confidence reflects how certain you are; prefer 0.0 over a speculative high score.
- Never invent rule_ids not present in the compliance matrix.
- Do NOT wrap the JSON in markdown fences."""

CRITIC_SYSTEM_PROMPT = """You are the Adversarial Critic — an independent IBM Granite verification context.

You receive a CLASSIFICATION CLAIM (a single potential violation) produced by a separate agent.
Your sole purpose is to determine whether the claim is genuinely entailed by the code evidence.

Respond with ONLY minified JSON (no markdown, no prose):
{"entailed":<bool>,"reasoning":"<one concise sentence>","adjusted_confidence":<float 0-1>}

Be strict:
- If the evidence is ambiguous, set entailed to false.
- If the claimed rule does not clearly map to the observed code pattern, set entailed to false.
- adjusted_confidence must be <= the original confidence when you downgrade, and may increase up to original+0.05 when you confirm."""


# ---------------------------------------------------------------------------
# .env loader
# ---------------------------------------------------------------------------

def _load_dotenv_if_present() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


_load_dotenv_if_present()


# ---------------------------------------------------------------------------
# URL normaliser
# ---------------------------------------------------------------------------

def _resolve_wml_url(url: str) -> str:
    """Remap dataplatform.cloud.ibm.com UI URLs to their WML API counterparts."""
    url = url.rstrip("/")
    remapped = re.sub(
        r"https://([a-z0-9-]+)\.dataplatform\.cloud\.ibm\.com",
        r"https://\1.ml.cloud.ibm.com",
        url,
    )
    if remapped == url and "dataplatform.cloud.ibm.com" in url:
        remapped = "https://us-south.ml.cloud.ibm.com"
    return remapped


# ---------------------------------------------------------------------------
# COS persistence helper
# ---------------------------------------------------------------------------

class _COSWriter:
    """Writes execution records to IBM Cloud Object Storage.

    Only initialised when COS_API_KEY, COS_INSTANCE_ID, and COS_BUCKET are
    all present in the environment; otherwise all write calls are no-ops so
    the engine degrades gracefully without COS credentials.
    """

    def __init__(self) -> None:
        self._client = None
        self._bucket = os.getenv("COS_BUCKET", "sentinel-spec-records")
        api_key      = os.getenv("COS_API_KEY")
        instance_id  = os.getenv("COS_INSTANCE_ID")
        endpoint     = os.getenv("COS_ENDPOINT", "https://s3.us-south.cloud-object-storage.appdomain.cloud")

        if not (api_key and instance_id):
            return

        try:
            import ibm_boto3
            from ibm_botocore.client import Config

            self._client = ibm_boto3.client(
                "s3",
                ibm_api_key_id=api_key,
                ibm_service_instance_id=instance_id,
                config=Config(signature_version="oauth"),
                endpoint_url=endpoint,
            )
        except Exception:
            self._client = None

    def write(self, record: ExecutionRecord) -> None:
        if self._client is None:
            return
        key = f"executions/{record.timestamp[:10]}/{record.record_id}.json"
        body = json.dumps(record.__dict__, default=str).encode("utf-8")
        try:
            self._client.put_object(Bucket=self._bucket, Key=key, Body=body)
        except Exception:
            pass  # COS write failure must never crash the evaluation path


_cos_writer = _COSWriter()


# ---------------------------------------------------------------------------
# Main IBM AI Engine
# ---------------------------------------------------------------------------

class IBMAIEngine(AIEnginePort):
    """Dual-agent IBM Granite compliance engine.

    Agent 1 (Sentinel Classifier) — classifies violations against the 22-rule matrix.
    Agent 2 (Adversarial Critic)  — independently verifies each classification.
    """

    def __init__(self) -> None:
        self.api_key    = os.getenv("WATSONX_APIKEY")
        self.project_id = os.getenv("PROJECT_ID")
        self.url        = _resolve_wml_url(
            os.getenv("WATSONX_URL", "https://eu-gb.ml.cloud.ibm.com")
        )
        self.model_id   = GRANITE_MODEL_ID
        self._model: ModelInference | None = None
        self._setup_error: str | None = None
        self._setup_model()

    def _setup_model(self) -> None:
        if not (self.api_key and self.project_id and self.url):
            return
        try:
            credentials = Credentials(url=self.url, api_key=self.api_key)
            self._model = ModelInference(
                model_id=self.model_id,
                credentials=credentials,
                project_id=self.project_id,
            )
        except Exception as exc:
            self._setup_error = str(exc)

    # ------------------------------------------------------------------
    # Low-level Granite call helpers
    # ------------------------------------------------------------------

    def _chat(self, messages: list[dict[str, str]], temperature: float = 0.0, max_tokens: int = 800) -> str:
        """Invoke the Granite chat endpoint and return the raw assistant text."""
        assert self._model is not None
        response = self._model.chat(
            messages=messages,
            params={"max_new_tokens": max_tokens, "temperature": temperature},
        )
        return (
            response
            .get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )

    @staticmethod
    def _strip_fences(text: str) -> str:
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text, flags=re.IGNORECASE)
        return text.strip()

    def _parse_json(self, raw: str) -> Any:
        return json.loads(self._strip_fences(raw))

    # ------------------------------------------------------------------
    # Agent 1 — Sentinel Classifier
    # ------------------------------------------------------------------

    def _run_classifier(self, code: CodeSnippet) -> list[ClassificationResult]:
        """Run Agent 1 against the full 22-rule compliance matrix."""
        messages = [
            {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Language: {code.language}\n"
                    f"File: {code.file_path}\n\n"
                    f"```\n{code.content}\n```"
                ),
            },
        ]
        raw = self._chat(messages, temperature=0.0, max_tokens=1200)
        payload = self._parse_json(raw)
        results: list[ClassificationResult] = []
        for item in payload.get("violations", []):
            if not isinstance(item, dict):
                continue
            results.append(
                ClassificationResult(
                    violates_policy=True,
                    confidence=float(item.get("confidence", 0.5)),
                    rationale=str(item.get("rationale", "")),
                    cited_chunk_ids=[item.get("rule_id", "")],
                    rule_id=str(item.get("rule_id", "SEC-001")),
                    severity=str(item.get("severity", "HIGH")),
                    line_number=int(item.get("line_number", 1)),
                    suggested_fix=str(item.get("suggested_fix", "Review this code path.")),
                )
            )
        return results

    # ------------------------------------------------------------------
    # Agent 2 — Adversarial Critic
    # ------------------------------------------------------------------

    def _run_critic(self, classification: ClassificationResult, code: CodeSnippet) -> CriticVerdict:
        """Run Agent 2 to independently verify a single classification claim."""
        claim_summary = (
            f"Rule: {classification.rule_id}\n"
            f"Severity: {classification.severity}\n"
            f"Confidence: {classification.confidence}\n"
            f"Rationale: {classification.rationale}\n"
            f"Suggested fix: {classification.suggested_fix}"
        )
        messages = [
            {"role": "system", "content": CRITIC_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"CLASSIFICATION CLAIM:\n{claim_summary}\n\n"
                    f"CODE EVIDENCE (Language: {code.language}, File: {code.file_path}):\n"
                    f"```\n{code.content}\n```"
                ),
            },
        ]
        raw = self._chat(messages, temperature=0.05, max_tokens=300)
        verdict = self._parse_json(raw)
        return CriticVerdict(
            entailed=bool(verdict.get("entailed", False)),
            reasoning=str(verdict.get("reasoning", "")),
            adjusted_confidence=float(verdict.get("adjusted_confidence", 0.0)),
        )

    # ------------------------------------------------------------------
    # Routing logic
    # ------------------------------------------------------------------

    @staticmethod
    def _route_finding(classification: ClassificationResult, critic: CriticVerdict) -> FindingTier:
        if not critic.entailed:
            return FindingTier.REJECTED
        confidence = critic.adjusted_confidence
        if confidence >= 0.85:
            return FindingTier.BLOCKING
        if confidence >= 0.5:
            return FindingTier.WARNING
        return FindingTier.LOGGED_ONLY

    # ------------------------------------------------------------------
    # Public synchronous interface
    # ------------------------------------------------------------------

    def evaluate_code(self, code: CodeSnippet, filename: str | None = None) -> ComplianceReport:
        resolved_filename = filename or code.file_path

        if self._model is None:
            return self._fallback_report(code, reason=self._setup_error or "missing_environment_configuration", filename=resolved_filename)

        try:
            classifications = self._run_classifier(code)
            violations: list[ComplianceViolation] = []
            routing_summary: list[dict[str, Any]] = []

            for cls in classifications:
                critic = self._run_critic(cls, code)
                tier   = self._route_finding(cls, critic)
                routing_summary.append({
                    "rule_id": cls.rule_id,
                    "tier": tier.value,
                    "critic_entailed": critic.entailed,
                    "adjusted_confidence": critic.adjusted_confidence,
                })
                if tier in (FindingTier.BLOCKING, FindingTier.WARNING):
                    violations.append(
                        ComplianceViolation(
                            rule_id=cls.rule_id,
                            severity=cls.severity,
                            line_number=cls.line_number,
                            description=cls.rationale,
                            suggested_fix=cls.suggested_fix,
                            confidence=critic.adjusted_confidence,
                            cited_chunk_ids=tuple(cls.cited_chunk_ids),
                            filename=resolved_filename,
                        )
                    )

            report = ComplianceReport(
                is_compliant=not violations,
                violations=violations,
                metadata={
                    "engine": "ibm",
                    "model": self.model_id,
                    "mode": "live",
                    "source": "watsonx",
                    "file_path": code.file_path,
                    "language": code.language,
                    "routing": routing_summary,
                },
                filename=resolved_filename,
            )
            self._persist_record(code, classifications, report)
            return report

        except Exception as exc:
            return self._fallback_report(code, reason=str(exc), filename=resolved_filename)

    # ------------------------------------------------------------------
    # Public streaming interface (async generator — yields thinking steps)
    # ------------------------------------------------------------------

    async def evaluate_code_stream(
        self, code: CodeSnippet, filename: str | None = None
    ) -> AsyncGenerator[AgentThinkingStep, None]:
        """Run the dual-agent DAG and yield observable thinking steps for live streaming."""
        resolved_filename = filename or code.file_path

        yield AgentThinkingStep(
            agent="system",
            phase="init",
            detail=f"Sentinel Spec initialised. Model: {self.model_id}. Analysing `{resolved_filename}` ({code.language}).",
            payload={"filename": resolved_filename},
        )

        if self._model is None:
            reason = self._setup_error or "missing_environment_configuration"
            yield AgentThinkingStep(
                agent="system",
                phase="error",
                detail=f"IBM Granite engine unavailable: {reason}. Running local fallback rules.",
                payload={"filename": resolved_filename},
            )
            report = self._fallback_report(code, reason=reason, filename=resolved_filename)
            yield AgentThinkingStep(
                agent="system",
                phase="complete",
                detail="Fallback analysis complete.",
                payload=_report_to_dict(report),
            )
            return

        # ---- Agent 1: Classifier ----
        yield AgentThinkingStep(
            agent="classifier",
            phase="start",
            detail="Agent 1 (Sentinel Classifier) engaging. Cross-referencing code against the 22-rule IBM compliance matrix via IBM Granite.",
            payload={"filename": resolved_filename},
        )

        await asyncio.sleep(0)  # yield control to event loop
        try:
            classifications = await asyncio.to_thread(self._run_classifier, code)
        except Exception as exc:
            yield AgentThinkingStep(
                agent="classifier",
                phase="error",
                detail=f"Classifier error: {exc}. Falling back to local rule engine.",
                payload={"filename": resolved_filename},
            )
            report = self._fallback_report(code, reason=str(exc), filename=resolved_filename)
            yield AgentThinkingStep(
                agent="system",
                phase="complete",
                detail="Fallback analysis complete.",
                payload=_report_to_dict(report),
            )
            return

        if not classifications:
            yield AgentThinkingStep(
                agent="classifier",
                phase="result",
                detail="Classifier found no violations against the compliance matrix.",
                payload={"violations_found": 0, "filename": resolved_filename},
            )
        else:
            yield AgentThinkingStep(
                agent="classifier",
                phase="result",
                detail=f"Classifier identified {len(classifications)} potential violation(s). Handing off to Adversarial Critic.",
                payload={"violations_found": len(classifications), "rules": [c.rule_id for c in classifications], "filename": resolved_filename},
            )

        # ---- Agent 2: Critic — iterates per classification ----
        violations: list[ComplianceViolation] = []
        routing_summary: list[dict[str, Any]] = []

        for idx, cls in enumerate(classifications, start=1):
            yield AgentThinkingStep(
                agent="critic",
                phase="verifying",
                detail=(
                    f"Adversarial Critic verifying claim {idx}/{len(classifications)}: "
                    f"[{cls.rule_id}] \"{cls.rationale[:120]}\" "
                    f"(classifier confidence: {cls.confidence:.2f})"
                ),
                payload={"rule_id": cls.rule_id, "classifier_confidence": cls.confidence, "filename": resolved_filename},
            )

            await asyncio.sleep(0)
            try:
                critic = await asyncio.to_thread(self._run_critic, cls, code)
            except Exception as exc:
                yield AgentThinkingStep(
                    agent="critic",
                    phase="error",
                    detail=f"Critic error for {cls.rule_id}: {exc}. Treating as unentailed to avoid false positive.",
                    payload={"filename": resolved_filename},
                )
                critic = CriticVerdict(entailed=False, reasoning=f"Critic error: {exc}", adjusted_confidence=0.0)

            tier = self._route_finding(cls, critic)
            routing_summary.append({
                "rule_id": cls.rule_id,
                "tier": tier.value,
                "critic_entailed": critic.entailed,
                "adjusted_confidence": critic.adjusted_confidence,
                "reasoning": critic.reasoning,
            })

            if not critic.entailed:
                yield AgentThinkingStep(
                    agent="critic",
                    phase="rejected",
                    detail=f"Claim [{cls.rule_id}] REJECTED — {critic.reasoning}. False positive eliminated.",
                    payload={"rule_id": cls.rule_id, "verdict": "rejected", "filename": resolved_filename},
                )
            else:
                yield AgentThinkingStep(
                    agent="critic",
                    phase="confirmed",
                    detail=(
                        f"Claim [{cls.rule_id}] CONFIRMED — {critic.reasoning} "
                        f"(adjusted confidence: {critic.adjusted_confidence:.2f}, tier: {tier.value})"
                    ),
                    payload={
                        "rule_id": cls.rule_id,
                        "verdict": tier.value,
                        "adjusted_confidence": critic.adjusted_confidence,
                        "filename": resolved_filename,
                    },
                )
                if tier in (FindingTier.BLOCKING, FindingTier.WARNING):
                    violations.append(
                        ComplianceViolation(
                            rule_id=cls.rule_id,
                            severity=cls.severity,
                            line_number=cls.line_number,
                            description=cls.rationale,
                            suggested_fix=cls.suggested_fix,
                            confidence=critic.adjusted_confidence,
                            cited_chunk_ids=tuple(cls.cited_chunk_ids),
                            filename=resolved_filename,
                        )
                    )

        # ---- Router summary ----
        yield AgentThinkingStep(
            agent="router",
            phase="routing",
            detail=(
                f"Routing complete. {len(violations)} violation(s) surfaced "
                f"({len([r for r in routing_summary if r['tier'] == 'blocking'])} blocking, "
                f"{len([r for r in routing_summary if r['tier'] == 'warning'])} warning, "
                f"{len([r for r in routing_summary if r['tier'] == 'rejected'])} rejected)."
            ),
            payload={"routing": routing_summary, "filename": resolved_filename},
        )

        report = ComplianceReport(
            is_compliant=not violations,
            violations=violations,
            metadata={
                "engine": "ibm",
                "model": self.model_id,
                "mode": "live",
                "source": "watsonx",
                "file_path": code.file_path,
                "language": code.language,
                "routing": routing_summary,
            },
            filename=resolved_filename,
        )
        self._persist_record(code, classifications, report)

        yield AgentThinkingStep(
            agent="system",
            phase="complete",
            detail=(
                "Analysis complete. "
                + ("No violations detected — code is compliant." if report.is_compliant
                   else f"{len(violations)} violation(s) require attention.")
            ),
            payload=_report_to_dict(report),
        )

    # ------------------------------------------------------------------
    # COS persistence
    # ------------------------------------------------------------------

    def _persist_record(
        self,
        code: CodeSnippet,
        classifications: list[ClassificationResult],
        report: ComplianceReport,
    ) -> None:
        record = ExecutionRecord(
            record_id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
            trigger="api",
            file_path=code.file_path,
            language=code.language,
            snippet_hash=hashlib.sha256(code.content.encode()).hexdigest(),
            classifier_result={"violations": [c.__dict__ for c in classifications]},
            critic_verdict=report.metadata.get("routing", []),
            finding_tier=FindingTier.BLOCKING.value if not report.is_compliant else FindingTier.REJECTED.value,
            final_violations=[
                {
                    "rule_id": v.rule_id,
                    "severity": v.severity,
                    "line_number": v.line_number,
                    "description": v.description,
                    "suggested_fix": v.suggested_fix,
                    "confidence": v.confidence,
                    "filename": v.filename,
                }
                for v in report.violations
            ],
            metadata=report.metadata,
        )
        _cos_writer.write(record)

    # ------------------------------------------------------------------
    # Fallback (no model / credential error)
    # ------------------------------------------------------------------

    def _fallback_report(self, code: CodeSnippet, reason: str, filename: str | None = None) -> ComplianceReport:
        resolved_filename = filename or code.file_path
        lowered = code.content.lower()
        violations: list[ComplianceViolation] = []

        credential_patterns = [
            ("ibm_secret_access_key", "SEC-001", "IBM secret access key detected in source code."),
            ("akia",                  "SEC-001", "Potential AWS/IBM access key ID pattern detected."),
            ("aws_secret_access_key", "SEC-001", "AWS secret access key detected in source code."),
            ("api_key",               "SEC-002", "Possible hard-coded API key identifier detected."),
            ("password =",            "SEC-001", "Hard-coded password assignment detected."),
        ]
        seen_rules = set()
        for pattern, rule_id, desc in credential_patterns:
            if pattern in lowered and rule_id not in seen_rules:
                violations.append(
                    ComplianceViolation(
                        rule_id=rule_id,
                        severity="CRITICAL",
                        line_number=1,
                        description=desc,
                        suggested_fix="Use a managed secret store (IBM Secrets Manager) and inject credentials at runtime.",
                        confidence=0.90,
                        filename=resolved_filename,
                    )
                )
                seen_rules.add(rule_id)

        return ComplianceReport(
            is_compliant=not violations,
            violations=violations,
            metadata={
                "engine": "ibm",
                "model": self.model_id,
                "mode": "fallback",
                "reason": reason,
                "file_path": code.file_path,
                "language": code.language,
            },
            filename=resolved_filename,
        )


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _report_to_dict(report: ComplianceReport) -> dict[str, Any]:
    return {
        "is_compliant": report.is_compliant,
        "filename": report.filename,
        "violations": [
            {
                "rule_id": v.rule_id,
                "severity": v.severity,
                "line_number": v.line_number,
                "description": v.description,
                "suggested_fix": v.suggested_fix,
                "confidence": v.confidence,
                "filename": v.filename,
            }
            for v in report.violations
        ],
        "metadata": report.metadata,
    }
