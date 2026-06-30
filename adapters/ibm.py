from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference

from domain.models import CodeSnippet, ComplianceReport, ComplianceViolation
from ports.ai_engine_port import AIEnginePort


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


class IBMAIEngine(AIEnginePort):
    """A Watsonx-backed compliance engine adapter for live IBM cloud evaluation."""

    def __init__(self) -> None:
        self.api_key = os.getenv("WATSONX_APIKEY")
        self.project_id = os.getenv("PROJECT_ID")
        self.url = self._resolve_wml_url(
            os.getenv("WATSONX_URL", "https://eu-gb.ml.cloud.ibm.com")
        )
        self.model_id = "meta-llama/llama-3-3-70b-instruct"
        self._model: ModelInference | None = None
        self._setup_error: str | None = None
        self._setup_model()

    @staticmethod
    def _resolve_wml_url(url: str) -> str:
        """Remap a dataplatform.cloud.ibm.com UI URL to its WML API counterpart.

        The SDK's PLATFORM_URLS_MAP only recognises *.ml.cloud.ibm.com hostnames
        as valid public SaaS endpoints. Users often copy the platform UI URL
        (e.g. eu-gb.dataplatform.cloud.ibm.com) instead of the WML API URL.
        This remapping keeps the connection on the correct IAM path without
        requiring manual credential corrections.
        """
        url = url.rstrip("/")
        # https://eu-gb.dataplatform.cloud.ibm.com -> https://eu-gb.ml.cloud.ibm.com
        remapped = re.sub(
            r"https://([a-z0-9-]+)\.dataplatform\.cloud\.ibm\.com",
            r"https://\1.ml.cloud.ibm.com",
            url,
        )
        if remapped == url and "dataplatform.cloud.ibm.com" in url:
            # bare https://dataplatform.cloud.ibm.com -> us-south default
            remapped = "https://us-south.ml.cloud.ibm.com"
        return remapped

    def _setup_model(self) -> None:
        if not (self.api_key and self.project_id and self.url):
            return
        try:
            credentials = Credentials(
                url=self.url,
                api_key=self.api_key,
            )
            self._model = ModelInference(
                model_id=self.model_id,
                credentials=credentials,
                project_id=self.project_id,
            )
        except Exception as exc:  # pragma: no cover - runtime integration path
            self._setup_error = str(exc)

    def evaluate_code(self, code: CodeSnippet) -> ComplianceReport:
        if self._model is None:
            return self._fallback_report(code, reason=self._setup_error or "missing_environment_configuration")

        try:
            messages = self._build_messages(code)
            raw_output = self._model.chat(
                messages=messages,
                params={"max_new_tokens": 300, "temperature": 0.0},
            )
            # chat() returns a dict; extract the assistant message text
            raw_output = (
                raw_output
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            payload = self._parse_model_payload(raw_output)
            return self._build_report_from_payload(payload, code)
        except Exception as exc:  # pragma: no cover - runtime integration path
            return self._fallback_report(code, reason=str(exc))

    def _build_messages(self, code: CodeSnippet) -> list[dict[str, str]]:
        schema_example = (
            '{"is_compliant": false, "violations": ['
            '{"rule_id": "SEC-001", "severity": "CRITICAL", "line_number": 1, '
            '"description": "reason", "suggested_fix": "fix"}]}'
        )
        return [
            {
                "role": "system",
                "content": (
                    "You are a strict security and architecture reviewer. "
                    "Evaluate the provided code for exposed secrets or architectural drift. "
                    "Return only a minified JSON object matching this schema exactly: "
                    f"{schema_example} "
                    "Do not wrap the answer in markdown fences or prose."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Language: {code.language}\n"
                    f"File: {code.file_path}\n\n"
                    f"```\n{code.content}\n```"
                ),
            },
        ]

    def _sanitize_model_output(self, raw_output: Any) -> str:
        text = str(raw_output).strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text, flags=re.IGNORECASE)
        return text.strip()

    def _parse_model_payload(self, raw_output: Any) -> dict[str, Any]:
        cleaned_output = self._sanitize_model_output(raw_output)
        parsed = json.loads(cleaned_output)
        if not isinstance(parsed, dict):
            raise ValueError("Watsonx response was not a JSON object")
        return parsed

    def _build_report_from_payload(self, payload: dict[str, Any], code: CodeSnippet) -> ComplianceReport:
        violations: list[ComplianceViolation] = []
        raw_violations = payload.get("violations", [])
        if isinstance(raw_violations, list):
            for item in raw_violations:
                if not isinstance(item, dict):
                    continue
                violations.append(
                    ComplianceViolation(
                        rule_id=str(item.get("rule_id", "SEC-001")),
                        severity=str(item.get("severity", "HIGH")),
                        line_number=int(item.get("line_number", 1)),
                        description=str(item.get("description", "Detected by Watsonx")),
                        suggested_fix=str(item.get("suggested_fix", "Review the flagged code")),
                    )
                )

        return ComplianceReport(
            is_compliant=bool(payload.get("is_compliant", not violations)),
            violations=violations,
            metadata={
                "engine": "ibm",
                "mode": "live",
                "source": "watsonx",
                "file_path": code.file_path,
                "language": code.language,
            },
        )

    def _fallback_report(self, code: CodeSnippet, reason: str) -> ComplianceReport:
        lowered = code.content.lower()
        violations: list[ComplianceViolation] = []

        if "aws_secret_access_key" in lowered or "akia" in lowered:
            violations.append(
                ComplianceViolation(
                    rule_id="SEC-001",
                    severity="CRITICAL",
                    line_number=1,
                    description="Potential exposure of an AWS secret access key detected in the provided code.",
                    suggested_fix="Use a managed secret store and remove hard-coded credentials.",
                )
            )

        return ComplianceReport(
            is_compliant=not violations,
            violations=violations,
            metadata={
                "engine": "ibm",
                "mode": "fallback",
                "reason": reason,
                "file_path": code.file_path,
                "language": code.language,
            },
        )
