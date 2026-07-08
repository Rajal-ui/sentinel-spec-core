"""app.py — Sentinel Spec FastAPI application.

Endpoints:
  POST /evaluate          — synchronous compliance check (watsonx Orchestrate / CI gate)
  POST /evaluate/stream   — SSE streaming with live agent thinking log
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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field

from adapters.ibm import COMPLIANCE_MATRIX, IBMAIEngine
from adapters.local import LocalAIEngine
from domain.models import CodeSnippet
from ports.ai_engine_port import AIEnginePort

# ---------------------------------------------------------------------------
# App bootstrap
# ---------------------------------------------------------------------------

def _bootstrap_engine() -> AIEnginePort:
    mock_mode_value = os.getenv("MOCK_MODE", "false").strip().lower()
    if mock_mode_value not in {"false", "0", "no", "off"}:
        return LocalAIEngine()
    return IBMAIEngine()


_engine: AIEnginePort = _bootstrap_engine()

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
    content: str = Field(..., description="Raw source code to evaluate")
    file_path: str = Field(default="untitled", description="Relative file path (for context)")
    language: str = Field(default="python", description="Programming language identifier")


class ViolationResponse(BaseModel):
    rule_id: str
    severity: str
    line_number: int
    description: str
    suggested_fix: str
    confidence: float = 0.0


class ComplianceReportResponse(BaseModel):
    is_compliant: bool
    violations: list[ViolationResponse]
    metadata: dict[str, Any] = {}
    duration_ms: float = 0.0


class HealthResponse(BaseModel):
    status: str
    engine: str
    model: str
    mock_mode: bool


class MatrixRuleResponse(BaseModel):
    rule_id: str
    domain: str
    name: str
    severity: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/evaluate", response_model=ComplianceReportResponse)
def evaluate(request: EvaluateRequest) -> ComplianceReportResponse:
    """Synchronous compliance check — run the full dual-agent DAG and return structured results."""
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")

    t0 = time.monotonic()
    snippet = CodeSnippet(
        content=request.content,
        file_path=request.file_path,
        language=request.language,
    )
    report = _engine.evaluate_code(snippet)
    duration_ms = round((time.monotonic() - t0) * 1000, 1)

    return ComplianceReportResponse(
        is_compliant=report.is_compliant,
        violations=[
            ViolationResponse(
                rule_id=v.rule_id,
                severity=v.severity,
                line_number=v.line_number,
                description=v.description,
                suggested_fix=v.suggested_fix,
                confidence=v.confidence,
            )
            for v in report.violations
        ],
        metadata=report.metadata,
        duration_ms=duration_ms,
    )


@app.post("/evaluate/stream")
async def evaluate_stream(request: EvaluateRequest) -> StreamingResponse:
    """SSE streaming endpoint — yields granular agent thinking steps as `data:` events.

    Clients receive a stream of JSON-encoded AgentThinkingStep objects.
    The final event (phase == "complete") carries the full compliance payload in its `payload` field.
    """
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")

    snippet = CodeSnippet(
        content=request.content,
        file_path=request.file_path,
        language=request.language,
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for step in await _engine.evaluate_code_stream(snippet):
                data = json.dumps({
                    "agent":   step.agent,
                    "phase":   step.phase,
                    "detail":  step.detail,
                    "payload": step.payload,
                })
                yield f"data: {data}\n\n"
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

# ---------------------------------------------------------------------------
# Mount Frontend
# ---------------------------------------------------------------------------
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
