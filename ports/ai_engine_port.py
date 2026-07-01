"""ports/ai_engine_port.py — Abstract port for compliance evaluation engines."""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator

from domain.models import AgentThinkingStep, CodeSnippet, ComplianceReport


class AIEnginePort(ABC):
    """Abstract interface for compliance evaluation engines."""

    @abstractmethod
    def evaluate_code(self, code: CodeSnippet) -> ComplianceReport:
        """Evaluate a code snippet synchronously and return a compliance report."""
        raise NotImplementedError

    @abstractmethod
    async def evaluate_code_stream(
        self, code: CodeSnippet
    ) -> AsyncGenerator[AgentThinkingStep, None]:
        """Evaluate a code snippet and yield granular thinking steps for SSE streaming."""
        raise NotImplementedError
        # Satisfy generator protocol for type-checkers; subclasses override fully.
        yield  # type: ignore[misc]
