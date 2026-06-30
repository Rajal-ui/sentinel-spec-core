from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class CodeSnippet:
    content: str
    file_path: str
    language: str


@dataclass(frozen=True)
class ComplianceViolation:
    rule_id: str
    severity: str
    line_number: int
    description: str
    suggested_fix: str


@dataclass(frozen=True)
class ComplianceReport:
    is_compliant: bool
    violations: list[ComplianceViolation]
    metadata: dict[str, Any] = field(default_factory=dict)
