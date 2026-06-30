from __future__ import annotations

from abc import ABC, abstractmethod

from domain.models import CodeSnippet, ComplianceReport


class AIEnginePort(ABC):
    """Abstract interface for compliance evaluation engines."""

    @abstractmethod
    def evaluate_code(self, code: CodeSnippet) -> ComplianceReport:
        """Evaluate a code snippet and return a compliance report."""
        raise NotImplementedError
