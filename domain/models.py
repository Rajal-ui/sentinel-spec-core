"""domain/models.py — Core domain value objects for Sentinel Spec.

All objects are frozen dataclasses; the domain layer has zero framework
dependencies — no SDK, no FastAPI, no Pydantic.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CodeSnippet:
    content: str
    file_path: str
    language: str


# ---------------------------------------------------------------------------
# Compliance outputs
# ---------------------------------------------------------------------------

class FindingTier(str, Enum):
    BLOCKING     = "blocking"
    WARNING      = "warning"
    LOGGED_ONLY  = "logged_only"
    REJECTED     = "rejected"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH     = "HIGH"
    MEDIUM   = "MEDIUM"
    LOW      = "LOW"
    INFO     = "INFO"


@dataclass(frozen=True)
class ComplianceViolation:
    rule_id: str
    severity: str
    line_number: int
    description: str
    suggested_fix: str
    confidence: float = 0.0
    cited_chunk_ids: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ComplianceReport:
    is_compliant: bool
    violations: list[ComplianceViolation]
    metadata: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Dual-agent DAG intermediary objects
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ClassificationResult:
    """Output of Agent 1 — The Sentinel Classifier."""
    violates_policy: bool
    confidence: float
    rationale: str
    cited_chunk_ids: list[str]
    rule_id: str
    severity: str
    line_number: int
    suggested_fix: str


@dataclass(frozen=True)
class CriticVerdict:
    """Output of Agent 2 — The Adversarial Critic."""
    entailed: bool
    reasoning: str
    adjusted_confidence: float


@dataclass(frozen=True)
class AgentThinkingStep:
    """A single observable step emitted during the dual-agent loop for SSE streaming."""
    agent: str        # "classifier" | "critic" | "router" | "system"
    phase: str        # human-readable phase label
    detail: str       # prose content of the step
    payload: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Execution record (written to IBM COS)
# ---------------------------------------------------------------------------

@dataclass
class ExecutionRecord:
    record_id: str
    timestamp: str
    trigger: str                 # "api" | "ide" | "ci"
    file_path: str
    language: str
    snippet_hash: str
    classifier_result: dict[str, Any]
    critic_verdict: dict[str, Any]
    finding_tier: str
    final_violations: list[dict[str, Any]]
    metadata: dict[str, Any] = field(default_factory=dict)
