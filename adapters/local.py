from __future__ import annotations

from domain.models import CodeSnippet, ComplianceReport, ComplianceViolation
from ports.ai_engine_port import AIEnginePort


class LocalAIEngine(AIEnginePort):
    """A local, dependency-light compliance engine for mock and offline use."""

    def evaluate_code(self, code: CodeSnippet) -> ComplianceReport:
        lowered = code.content.lower()
        violations: list[ComplianceViolation] = []

        if "aws_secret_access_key" in lowered or "akia" in lowered:
            violations.append(
                ComplianceViolation(
                    rule_id="SEC-001",
                    severity="high",
                    line_number=1,
                    description="Potential exposure of an AWS secret access key in source code.",
                    suggested_fix="Move the secret to a secure secret manager and reference it at runtime.",
                )
            )

        return ComplianceReport(
            is_compliant=not violations,
            violations=violations,
            metadata={"engine": "local", "mode": "mock"},
        )
