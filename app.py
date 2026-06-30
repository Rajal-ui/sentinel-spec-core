"""app.py — FastAPI HTTP interface for the Sentinel Spec compliance engine.

Exposes the /evaluate endpoint declared in sentinel_spec_openapi.json so the
service can be imported into watsonx Orchestrate as a registered skill.
"""
from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from adapters.ibm import IBMAIEngine
from adapters.local import LocalAIEngine
from domain.models import CodeSnippet
from ports.ai_engine_port import AIEnginePort

# ---------------------------------------------------------------------------
# Engine bootstrap
# ---------------------------------------------------------------------------

def _bootstrap_engine() -> AIEnginePort:
    mock_mode_value = os.getenv("MOCK_MODE", "false").strip().lower()
    if mock_mode_value not in {"false", "0", "no", "off"}:
        return LocalAIEngine()
    return IBMAIEngine()


_engine: AIEnginePort = _bootstrap_engine()

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Sentinel Spec Compliance Engine",
    version="1.0.0",
    description=(
        "Evaluates source code snippets for security violations and architectural drift. "
        "Designed for import into watsonx Orchestrate as a reusable Agent-as-Code skill."
    ),
)


# ---------------------------------------------------------------------------
# Request / response schemas (mirrors domain/models.py and the OpenAPI spec)
# ---------------------------------------------------------------------------

class EvaluateRequest(BaseModel):
    content: str
    file_path: str
    language: str


class ViolationResponse(BaseModel):
    rule_id: str
    severity: str
    line_number: int
    description: str
    suggested_fix: str


class ComplianceReportResponse(BaseModel):
    is_compliant: bool
    violations: list[ViolationResponse]
    metadata: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/evaluate", response_model=ComplianceReportResponse)
def evaluate(request: EvaluateRequest) -> ComplianceReportResponse:
    """Run a compliance assessment against the provided source code snippet."""
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")

    snippet = CodeSnippet(
        content=request.content,
        file_path=request.file_path,
        language=request.language,
    )

    report = _engine.evaluate_code(snippet)

    return ComplianceReportResponse(
        is_compliant=report.is_compliant,
        violations=[
            ViolationResponse(
                rule_id=v.rule_id,
                severity=v.severity,
                line_number=v.line_number,
                description=v.description,
                suggested_fix=v.suggested_fix,
            )
            for v in report.violations
        ],
        metadata=report.metadata,
    )


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe — returns 200 when the server is running."""
    return {"status": "ok"}
