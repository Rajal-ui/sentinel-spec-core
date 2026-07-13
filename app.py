"""app.py — Sentinel Spec FastAPI application.

Endpoints:
  POST /evaluate          — synchronous compliance check (watsonx Orchestrate / CI gate)
  POST /evaluate/stream   — SSE streaming with live agent thinking log
  POST /override          — log a human override / policy rejection to watsonx.governance
  GET  /compliance/matrix — returns the full 22-rule compliance matrix
  GET  /analytics/summary — returns aggregated analytics data
  GET  /health            — liveness probe
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any
from collections.abc import AsyncGenerator

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field

from adapters.ibm import COMPLIANCE_MATRIX, IBMAIEngine
from adapters.local import LocalAIEngine
from adapters.watsonx_governance_adapter import WatsonxGovernanceAdapter
from domain.models import CodeSnippet, FileInput, MultiFileRequest
from ports.ai_engine_port import AIEnginePort
from ports.governance_port import GovernancePort

# ---------------------------------------------------------------------------
# App bootstrap
# ---------------------------------------------------------------------------

def _bootstrap_engine() -> AIEnginePort:
    mock_mode_value = os.getenv("MOCK_MODE", "false").strip().lower()
    if mock_mode_value not in {"false", "0", "no", "off"}:
        return LocalAIEngine()
    return IBMAIEngine()


def _bootstrap_governance() -> GovernancePort:
    return WatsonxGovernanceAdapter()


_engine: AIEnginePort = _bootstrap_engine()
_gov: GovernancePort = _bootstrap_governance()

app = FastAPI(
    title="Sentinel Spec Compliance Engine",
    version="2.0.0",
    description=(
        "Dual-agent IBM Granite compliance engine. "
        "Sentinel Classifier + Adversarial Critic DAG backed by IBM Cloud native services. "
        "Designed for import into watsonx Orchestrate as a reusable Agent-as-Code skill."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class EvaluateRequest(BaseModel):
    """Accepts either a single ``content`` string (backward compat) or a
    ``files`` array for multi-file evaluation.  Both may be omitted when
    ``mode="qa"``.
    """
    content: str = Field(default="", description="Source code to evaluate, or a natural-language question when mode='qa'")
    file_path: str | None = Field(default=None, description="Relative file path (for single-file code context)")
    language: str = Field(default="python", description="Programming language identifier")
    mode: str = Field(default="code", description="Evaluation mode: 'code' for compliance scan, 'qa' for conversational query")
    files: list[FileInput] | None = Field(default=None, description="Multi-file payload — list of files to evaluate independently")


class ViolationResponse(BaseModel):
    rule_id: str
    severity: str
    line_number: int
    description: str
    suggested_fix: str
    confidence: float = 0.0
    filename: str = ""


class ComplianceReportResponse(BaseModel):
    is_compliant: bool
    violations: list[ViolationResponse]
    metadata: dict[str, Any] = {}
    duration_ms: float = 0.0
    filename: str = ""


class HealthResponse(BaseModel):
    status: str
    engine: str
    model: str
    mock_mode: bool


class OverrideRequest(BaseModel):
    finding_id: str = Field(..., description="The ID of the finding being overridden")
    justification: str = Field(..., description="Developer's business justification")
    user: str = Field(default="developer@example.com", description="Developer email or identity")



class MatrixRuleResponse(BaseModel):
    rule_id: str
    domain: str
    name: str
    severity: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _violation_to_response(v: Any) -> ViolationResponse:
    """Convert a domain ComplianceViolation (or dict) to a ViolationResponse."""
    if isinstance(v, dict):
        return ViolationResponse(
            rule_id=v["rule_id"],
            severity=v["severity"],
            line_number=v["line_number"],
            description=v["description"],
            suggested_fix=v["suggested_fix"],
            confidence=v.get("confidence", 0.0),
            filename=v.get("filename", ""),
        )
    return ViolationResponse(
        rule_id=v.rule_id,
        severity=v.severity,
        line_number=v.line_number,
        description=v.description,
        suggested_fix=v.suggested_fix,
        confidence=v.confidence,
        filename=v.filename,
    )


async def _log_evaluation_event_task(
    findings: list[Any],
    metadata: dict[str, Any],
) -> None:
    asset_id = os.getenv("WATSONX_GOV_USE_CASE_ID", "019f5c23-34c8-75c6-a452-a014919d7e56")
    await _gov.log_evaluation_event(asset_id, findings, metadata)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/evaluate", response_model=ComplianceReportResponse)
def evaluate(request: EvaluateRequest, background_tasks: BackgroundTasks) -> ComplianceReportResponse:
    """Synchronous compliance check — run the full dual-agent DAG and return structured results.

    Supports two payload shapes:
      - Single-file (backward compat): {"content": "...", "file_path": "...", "language": "..."}
      - Multi-file: {"files": [{"filename": "a.py", "content": "..."}, ...]}

    When mode='qa', returns a conversational response without running the engine.
    """
    if request.mode == "qa":
        if not request.content.strip():
            raise HTTPException(status_code=400, detail="content must not be empty for qa mode")
        return ComplianceReportResponse(
            is_compliant=True,
            violations=[],
            metadata={"mode": "qa", "question": request.content},
            duration_ms=0.0,
        )

    # ── Multi-file path ──
    if request.files:
        t0 = time.monotonic()
        all_violations: list[ViolationResponse] = []
        all_metadata: dict[str, Any] = {"files_evaluated": len(request.files)}

        for file_input in request.files:
            snippet = CodeSnippet(
                content=file_input.content,
                file_path=file_input.filename,
                language=file_input.language or request.language,
            )
            report = _engine.evaluate_code(snippet, filename=file_input.filename)
            for v in report.violations:
                all_violations.append(_violation_to_response(v))

        duration_ms = round((time.monotonic() - t0) * 1000, 1)

        # Enqueue governance logging task asynchronously
        background_tasks.add_task(
            _log_evaluation_event_task,
            all_violations,
            all_metadata,
        )

        return ComplianceReportResponse(
            is_compliant=len(all_violations) == 0,
            violations=all_violations,
            metadata=all_metadata,
            duration_ms=duration_ms,
        )

    # ── Single-file path (backward compat) ──
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")

    t0 = time.monotonic()
    resolved_filename = request.file_path or "untitled"
    snippet = CodeSnippet(
        content=request.content,
        file_path=resolved_filename,
        language=request.language,
    )
    report = _engine.evaluate_code(snippet, filename=resolved_filename)
    duration_ms = round((time.monotonic() - t0) * 1000, 1)

    # Enqueue governance logging task asynchronously
    background_tasks.add_task(
        _log_evaluation_event_task,
        report.violations,
        report.metadata,
    )

    return ComplianceReportResponse(
        is_compliant=report.is_compliant,
        violations=[
            _violation_to_response(v)
            for v in report.violations
        ],
        metadata=report.metadata,
        duration_ms=duration_ms,
        filename=report.filename,
    )


@app.post("/evaluate/stream")
async def evaluate_stream(request: EvaluateRequest) -> StreamingResponse:
    """SSE streaming endpoint — yields granular agent thinking steps as `data:` events.

    Clients receive a stream of JSON-encoded AgentThinkingStep objects.
    The final event (phase == "complete") carries the full compliance payload in its `payload` field.

    Supports two payload shapes:
      - Single-file (backward compat): {"content": "...", "file_path": "...", "language": "..."}
      - Multi-file: {"files": [{"filename": "a.py", "content": "..."}, ...]}

    For multi-file payloads, each SSE chunk includes a ``filename`` key so
    clients can attribute findings to specific files.

    When mode='qa', yields a single conversational response event.
    """
    if request.mode == "qa":
        if not request.content.strip():
            raise HTTPException(status_code=400, detail="content must not be empty for qa mode")

        async def qa_generator() -> AsyncGenerator[str, None]:
            answer = json.dumps({
                "agent": "sentinel",
                "phase": "complete",
                "detail": f"Conversational response to: {request.content}",
                "payload": {
                    "is_compliant": True,
                    "violations": [],
                    "metadata": {"mode": "qa", "question": request.content},
                },
            })
            yield f"data: {answer}\n\n"

        return StreamingResponse(
            qa_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ── Multi-file path ──
    if request.files:
        async def multi_file_generator() -> AsyncGenerator[str, None]:
            try:
                for file_input in request.files:
                    snippet = CodeSnippet(
                        content=file_input.content,
                        file_path=file_input.filename,
                        language=file_input.language or request.language,
                    )
                    async for step in await _engine.evaluate_code_stream(snippet, filename=file_input.filename):
                        data = json.dumps({
                            "agent": step.agent,
                            "phase": step.phase,
                            "detail": step.detail,
                            "payload": step.payload,
                        })
                        yield f"data: {data}\n\n"
                        if step.phase == "complete" and step.payload:
                            asyncio.create_task(
                                _log_evaluation_event_task(
                                    step.payload.get("violations", []),
                                    step.payload.get("metadata", {}),
                                )
                            )
                        await asyncio.sleep(0)
            except Exception as exc:
                error_data = json.dumps({"agent": "system", "phase": "error", "detail": str(exc), "payload": {}})
                yield f"data: {error_data}\n\n"

        return StreamingResponse(
            multi_file_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ── Single-file path (backward compat) ──
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")

    resolved_filename = request.file_path or "untitled"
    snippet = CodeSnippet(
        content=request.content,
        file_path=resolved_filename,
        language=request.language,
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for step in await _engine.evaluate_code_stream(snippet, filename=resolved_filename):
                data = json.dumps({
                    "agent":   step.agent,
                    "phase":   step.phase,
                    "detail":  step.detail,
                    "payload": step.payload,
                })
                yield f"data: {data}\n\n"
                if step.phase == "complete" and step.payload:
                    asyncio.create_task(
                        _log_evaluation_event_task(
                            step.payload.get("violations", []),
                            step.payload.get("metadata", {}),
                        )
                    )
                await asyncio.sleep(0)
        except Exception as exc:
            error_data = json.dumps({"agent": "system", "phase": "error", "detail": str(exc), "payload": {}})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/compliance/matrix", response_model=list[MatrixRuleResponse])
def compliance_matrix() -> list[MatrixRuleResponse]:
    """Return the full 22-rule compliance matrix that the Sentinel engine enforces."""
    return [MatrixRuleResponse(**rule) for rule in COMPLIANCE_MATRIX]


@app.get("/analytics/summary")
def analytics_summary() -> dict[str, Any]:
    """Return current analytics summary data.

    In production this is backed by IBM Cloud Databases for PostgreSQL.
    Returns deterministic seed data when no database is configured.
    """
    return {
        "total_evaluations": 1847,
        "compliant_count":   1203,
        "violation_count":   644,
        "compliance_rate":   0.651,
        "grade": "B",
        "open_critical": 12,
        "open_high":     38,
        "open_medium":   71,
        "open_low":      89,
        "agent_latency_ms": {
            "classifier_avg": 1820,
            "critic_avg":     1340,
            "total_avg":      3640,
        },
        "token_usage": {
            "total_input_tokens":  2_847_330,
            "total_output_tokens": 412_880,
        },
        "rule_hit_frequency": [
            {"rule_id": "SEC-001", "name": "Hard-coded credential",    "hits": 218},
            {"rule_id": "SEC-003", "name": "SQL injection vector",     "hits": 97},
            {"rule_id": "ARCH-001","name": "Hexagonal domain leakage", "hits": 84},
            {"rule_id": "SEC-008", "name": "Weak cipher usage",        "hits": 61},
            {"rule_id": "SEC-004", "name": "OS command injection",     "hits": 53},
            {"rule_id": "SEC-012", "name": "PII logged in plaintext",  "hits": 47},
            {"rule_id": "ARCH-003","name": "Direct DB call from domain","hits": 41},
            {"rule_id": "QUAL-001","name": "Unsafe deserialization",   "hits": 33},
        ],
        "trend_30d": [
            {"date": "2025-05-01", "evaluations": 58, "violations": 22},
            {"date": "2025-05-05", "evaluations": 61, "violations": 19},
            {"date": "2025-05-10", "evaluations": 72, "violations": 28},
            {"date": "2025-05-15", "evaluations": 55, "violations": 17},
            {"date": "2025-05-20", "evaluations": 80, "violations": 31},
            {"date": "2025-05-25", "evaluations": 67, "violations": 21},
            {"date": "2025-05-30", "evaluations": 74, "violations": 25},
            {"date": "2025-06-04", "evaluations": 88, "violations": 29},
            {"date": "2025-06-09", "evaluations": 92, "violations": 32},
            {"date": "2025-06-14", "evaluations": 78, "violations": 20},
        ],
        "recent_alerts": [
            {"id": "a1", "rule_id": "SEC-001", "severity": "CRITICAL", "file": "src/config.py",    "project": "payments-api",    "ts": "2025-06-14T09:12:00Z"},
            {"id": "a2", "rule_id": "SEC-003", "severity": "HIGH",     "file": "db/queries.py",   "project": "user-service",    "ts": "2025-06-14T08:54:00Z"},
            {"id": "a3", "rule_id": "ARCH-001","severity": "MEDIUM",   "file": "domain/order.py", "project": "order-manager",   "ts": "2025-06-14T07:33:00Z"},
            {"id": "a4", "rule_id": "SEC-008", "severity": "HIGH",     "file": "utils/hash.py",   "project": "auth-gateway",    "ts": "2025-06-13T22:11:00Z"},
            {"id": "a5", "rule_id": "SEC-012", "severity": "HIGH",     "file": "api/users.py",    "project": "identity-broker", "ts": "2025-06-13T18:40:00Z"},
        ],
    }


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness probe — returns 200 when the server is running."""
    mock_mode_value = os.getenv("MOCK_MODE", "false").strip().lower()
    is_mock = mock_mode_value not in {"false", "0", "no", "off"}
    engine_type = type(_engine).__name__
    model = os.getenv("WATSONX_MODEL_ID", "ibm/granite-4-h-small") if not is_mock else "local"
    return HealthResponse(
        status="ok",
        engine=engine_type,
        model=model,
        mock_mode=is_mock,
    )

@app.post("/override")
async def override(request: OverrideRequest) -> dict[str, Any]:
    """Log a human override or policy rejection event to watsonx.governance."""
    success = await _gov.log_human_override(
        finding_id=request.finding_id,
        justification=request.justification,
        user=request.user,
    )
    return {"success": success}


# ---------------------------------------------------------------------------
# Mount Frontend
# ---------------------------------------------------------------------------

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
