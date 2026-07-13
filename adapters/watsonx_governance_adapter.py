"""adapters/watsonx_governance_adapter.py — Watsonx governance lineage tracking adapter."""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

from ports.governance_port import GovernancePort

logger = logging.getLogger("sentinel.governance")


class WatsonxGovernanceAdapter(GovernancePort):
    """Adapter to log runtime compliance events to IBM watsonx.governance."""

    def __init__(self) -> None:
        self.apikey = os.getenv("WATSONX_APIKEY")
        self.use_case_id = os.getenv(
            "WATSONX_GOV_USE_CASE_ID", "019f5c23-34c8-75c6-a452-a014919d7e56"
        )
        # Remap or default the governance base URL
        watsonx_url = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
        self.gov_url = os.getenv("WATSONX_GOV_URL", watsonx_url).rstrip("/")
        
        # Check mock mode
        mock_mode_val = os.getenv("MOCK_MODE", "false").strip().lower()
        self.mock_mode = mock_mode_val not in {"false", "0", "no", "off"}
        
        # Token cache
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    async def _get_iam_token(self) -> str | None:
        """Fetch IBM Cloud IAM token using the configured API Key."""
        if not self.apikey:
            logger.warning("WATSONX_APIKEY is not set. Cannot fetch IAM token.")
            return None

        # Reuse cached token if valid
        now = time.monotonic()
        if self._token and now < self._token_expires_at:
            return self._token

        iam_url = "https://iam.cloud.ibm.com/identity/token"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": self.apikey,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(iam_url, headers=headers, data=data)
                response.raise_for_status()
                res_data = response.json()
                
                self._token = res_data["access_token"]
                # Expire 60 seconds early to prevent edge failures
                expires_in = float(res_data.get("expires_in", 3600))
                self._token_expires_at = now + expires_in - 60.0
                return self._token
        except Exception as exc:
            logger.error(f"Failed to fetch IAM token from IBM Cloud: {exc}")
            return None

    async def log_evaluation_event(
        self, asset_id: str, findings: list[Any], execution_metadata: dict[str, Any]
    ) -> bool:
        """Log a code compliance evaluation event to watsonx.governance."""
        resolved_asset_id = asset_id or self.use_case_id
        
        payload = {
            "asset_id": resolved_asset_id,
            "event_type": "evaluation",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "findings": [
                {
                    "rule_id": getattr(f, "rule_id", f.get("rule_id") if isinstance(f, dict) else str(f)),
                    "severity": getattr(f, "severity", f.get("severity") if isinstance(f, dict) else "UNKNOWN"),
                    "line_number": getattr(f, "line_number", f.get("line_number") if isinstance(f, dict) else 1),
                    "description": getattr(f, "description", f.get("description") if isinstance(f, dict) else ""),
                    "confidence": getattr(f, "confidence", f.get("confidence") if isinstance(f, dict) else 0.0),
                    "filename": getattr(f, "filename", f.get("filename") if isinstance(f, dict) else ""),
                }
                for f in findings
            ],
            "metadata": execution_metadata,
        }

        if self.mock_mode:
            logger.info(
                f"[MOCK MODE] Logging evaluation event for asset {resolved_asset_id}: {payload}"
            )
            return True

        token = await self._get_iam_token()
        if not token:
            logger.error("Could not obtain auth token to log evaluation event.")
            return False

        # Post event directly to the watsonx.governance Factsheets events backend API
        endpoint = f"{self.gov_url}/v2/model_entries/{resolved_asset_id}/events"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Include query version parameter required by watsonx data platform APIs
                response = await client.post(
                    endpoint,
                    headers=headers,
                    json=payload,
                    params={"version": "2024-03-01"},
                )
                if response.status_code >= 400:
                    logger.error(
                        f"watsonx.governance API returned error status {response.status_code}: {response.text}"
                    )
                    return False
                return True
        except Exception as exc:
            logger.error(f"Error calling watsonx.governance REST API: {exc}")
            return False

    async def log_human_override(
        self, finding_id: str, justification: str, user: str
    ) -> bool:
        """Log a human override or policy rejection event to watsonx.governance."""
        payload = {
            "finding_id": finding_id,
            "event_type": "override",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "override": {
                "occurred": True,
                "actor": user,
                "justification": justification,
            },
        }

        resolved_asset_id = self.use_case_id

        if self.mock_mode:
            logger.info(
                f"[MOCK MODE] Logging human override for finding {finding_id}: {payload}"
            )
            return True

        token = await self._get_iam_token()
        if not token:
            logger.error("Could not obtain auth token to log human override event.")
            return False

        endpoint = f"{self.gov_url}/v2/model_entries/{resolved_asset_id}/events"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    endpoint,
                    headers=headers,
                    json=payload,
                    params={"version": "2024-03-01"},
                )
                if response.status_code >= 400:
                    logger.error(
                        f"watsonx.governance API returned error status {response.status_code}: {response.text}"
                    )
                    return False
                return True
        except Exception as exc:
            logger.error(f"Error logging human override to watsonx.governance: {exc}")
            return False
