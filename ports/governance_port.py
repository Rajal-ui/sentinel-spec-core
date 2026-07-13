"""ports/governance_port.py — Abstract port for Runtime Governance tracking."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class GovernancePort(ABC):
    """Abstract interface for logging governance events and human overrides."""

    @abstractmethod
    async def log_evaluation_event(
        self, asset_id: str, findings: list[Any], execution_metadata: dict[str, Any]
    ) -> bool:
        """Log a code compliance evaluation event to watsonx.governance.

        Args:
            asset_id: The design-time asset ID or use case ID.
            findings: List of identified violations.
            execution_metadata: Key-value metadata from the dual-agent run.

        Returns:
            bool: True if logged successfully, False otherwise.
        """
        raise NotImplementedError

    @abstractmethod
    async def log_human_override(
        self, finding_id: str, justification: str, user: str
    ) -> bool:
        """Log a human override or policy rejection event to watsonx.governance.

        Args:
            finding_id: The ID of the finding being overridden.
            justification: Developer's business justification.
            user: Developer email or identity.

        Returns:
            bool: True if logged successfully, False otherwise.
        """
        raise NotImplementedError
