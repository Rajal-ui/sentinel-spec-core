"""ports/ai_engine_port.py — Abstract port for compliance evaluation engines."""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator

from domain.models import AgentThinkingStep, CodeSnippet, ComplianceReport


class AIEnginePort(ABC):
    """Abstract interface for compliance evaluation engines."""

    @abstractmethod
    def evaluate_code(self, code: CodeSnippet, filename: str | None = None) -> ComplianceReport:
        """Evaluate a code snippet synchronously and return a compliance report.

        Args:
            code: The code snippet to evaluate.
            filename: Optional explicit filename to attribute violations to.
                      Falls back to ``code.file_path`` when *None*.
        """
        raise NotImplementedError

    @abstractmethod
    async def evaluate_code_stream(
        self, code: CodeSnippet, filename: str | None = None
    ) -> AsyncGenerator[AgentThinkingStep, None]:
        """Evaluate a code snippet and yield granular thinking steps for SSE streaming.

        Args:
            code: The code snippet to evaluate.
            filename: Optional explicit filename to attribute violations to.
                      Falls back to ``code.file_path`` when *None*.

        Yields:
            AgentThinkingStep objects. The final ``phase="complete"`` step's
            ``payload`` dict always contains a ``"filename"`` key.
        """
        raise NotImplementedError
        # Satisfy generator protocol for type-checkers; subclasses override fully.
        yield  # type: ignore[misc]
