"""adapters/watsonx_governance_adapter.py — Watsonx governance lineage tracking adapter using the ibm-watsonx-ai SDK."""
from __future__ import annotations

import logging
import os
import sys
import time
import traceback
from typing import Any

import httpx
from ibm_watsonx_ai import APIClient, Credentials

from ports.governance_port import GovernancePort

# ---------------------------------------------------------------------------
# Guaranteed-visible logger — always writes to stderr even with no handler
# ---------------------------------------------------------------------------

logger = logging.getLogger("sentinel.governance")
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stderr)
    _handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] sentinel.governance: %(message)s")
    )
    logger.addHandler(_handler)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False


class WatsonxGovernanceAdapter(GovernancePort):
    """Adapter to log runtime compliance events to IBM watsonx.governance using the official SDK."""

    def __init__(self) -> None:
        self.apikey = os.getenv("WATSONX_APIKEY", "").strip()
        self.watsonx_url = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com").strip()
        self.project_id = os.getenv("PROJECT_ID", "4f694685-8508-4e8a-8b1b-3e78fdd2b6fc").strip()
        self.use_case_id = os.getenv("WATSONX_GOV_USE_CASE_ID", "019f5c23-34c8-75c6-a452-a014919d7e56").strip()
        self.inventory_id = os.getenv("WATSONX_INVENTORY_ID", "019f5c00-410a-7344-8c5b-c38acca3483d").strip()

        # Dedicated regional governance host
        gov_url = os.getenv("WATSONX_GOVERNANCE_URL", "").strip() or "https://api.ai.cloud.ibm.com"
        self.gov_url = gov_url.rstrip("/")

        mock_mode_val = os.getenv("MOCK_MODE", "false").strip().lower()
        self.mock_mode = mock_mode_val not in {"false", "0", "no", "off"}

        # Initialize the official ibm-watsonx-ai SDK client
        self.client: APIClient | None = None
        self._init_sdk_client()

    def _init_sdk_client(self) -> None:
        if self.mock_mode:
            logger.info("[SDK-INIT] MOCK_MODE=true — skipping SDK initialization.")
            return

        if not self.apikey:
            logger.error("[SDK-INIT] WATSONX_APIKEY is not set — events cannot be shipped.")
            return

        try:
            logger.info("[SDK-INIT] Initialising APIClient for %s", self.watsonx_url)
            creds = Credentials(url=self.watsonx_url, api_key=self.apikey)
            self.client = APIClient(creds)
            if self.project_id:
                self.client.set.default_project(self.project_id)
            logger.info("[SDK-INIT] APIClient successfully configured.")
        except Exception as exc:
            logger.error("[SDK-INIT] Failed to configure APIClient: %s\n%s", exc, traceback.format_exc())

    async def push_lifecycle_facts(self, endpoint: str, payload: dict[str, Any]) -> bool:
        """Pushes lifecycle facts using the official SDK call, falling back to REST if unavailable."""
        if not self.client:
            logger.error("[SDK-PUSH] APIClient is not initialised.")
            return False

        # Attempt to use the requested client.governance.external_lifecycle_facts.add method
        try:
            logger.info("[SDK-PUSH] Attempting native client.governance.external_lifecycle_facts.add call")
            logger.info("[SDK-PUSH] Request Payload: %s", payload)
            
            # The client.governance attribute is checked dynamically
            gov_ref = getattr(self.client, "governance", None)
            if gov_ref is None:
                raise AttributeError("client.governance module not present in current SDK version")
            
            facts_ref = getattr(gov_ref, "external_lifecycle_facts", None)
            if facts_ref is None:
                raise AttributeError("governance.external_lifecycle_facts module not present in current SDK version")
            
            # Call native add method
            response = facts_ref.add(
                use_case_id=self.use_case_id,
                inventory_id=self.inventory_id,
                payload=payload
            )
            print("[SDK-PUSH] Response object from native SDK:", response)
            logger.info("[SDK-PUSH] Native SDK call successful. Response: %s", response)
            return True
            
        except AttributeError as attr_err:
            logger.warning("[SDK-PUSH] Native SDK method unavailable (%s). Falling back to REST pipeline.", attr_err)
        except Exception as exc:
            print("[SDK-PUSH] Native SDK call failed with exception:", exc)
            logger.error(
                "[SDK-PUSH] Native SDK call failed.\n"
                "  Payload   : %s\n"
                "  Exception : %s\n"
                "  Traceback : %s",
                payload, exc, traceback.format_exc()
            )
            # Fall back to HTTP pipeline on general invocation error

        # HTTP fallback
        try:
            headers = self.client.get_headers()
            headers["Content-Type"] = "application/json"
            headers["Accept"] = "application/json"
        except Exception as exc:
            logger.error("[SDK-PUSH] Failed to retrieve auth headers from SDK: %s", exc)
            return False

        logger.info("[SDK-PUSH] POST %s", endpoint)
        logger.debug("[SDK-PUSH] Payload: %s", payload)

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0)) as http_client:
                response = await http_client.post(endpoint, headers=headers, json=payload)

            if response.status_code in (200, 201, 202):
                logger.info("[SDK-PUSH] Fact accepted via fallback (HTTP %s).", response.status_code)
                return True

            logger.error(
                "[SDK-PUSH] REST Fallback REJECTED — HTTP %s\n"
                "  URL  : %s\n"
                "  Body : %s",
                response.status_code,
                endpoint,
                response.text,
            )
            return False

        except httpx.ConnectError as exc:
            logger.error("[SDK-PUSH] Connection failed to %s: %s", endpoint, exc)
        except httpx.TimeoutException as exc:
            logger.error("[SDK-PUSH] Timeout posting to %s: %s", endpoint, exc)
        except Exception as exc:
            logger.error("[SDK-PUSH] Unexpected error: %s\n%s", exc, traceback.format_exc())

        return False

    def _facts_endpoint(self, use_case_id: str) -> str:
        # Route prefix: /ml/v4/governance/model_inventories/...
        return (
            f"{self.gov_url}/ml/v4/governance/model_inventories/{self.inventory_id}"
            f"/ai_use_cases/{use_case_id}/external_lifecycle_facts"
        )

    # ------------------------------------------------------------------
    # GovernancePort implementation
    # ------------------------------------------------------------------

    async def log_evaluation_event(
        self, asset_id: str, findings: list[Any], execution_metadata: dict[str, Any]
    ) -> bool:
        resolved_id = (asset_id or self.use_case_id).strip()

        # Calculate average confidence
        valid_findings = []
        for f in findings:
            if isinstance(f, dict):
                valid_findings.append(f)
            else:
                valid_findings.append({
                    "confidence": getattr(f, "confidence", 0.0),
                })
        conf_sum = sum(float(f.get("confidence", 0.0)) for f in valid_findings)
        avg_conf = round(conf_sum / len(valid_findings), 4) if valid_findings else 0.0

        payload: dict[str, Any] = {
            "entity": {
                "name": "Sentinel Automated Review",
                "description": "Asynchronous dual-agent code analysis rule verification.",
                "state": "completed",
                "system": "Sentinel-Spec-Engine",
                "metrics": [
                    {"id": "policy_violations", "value": len(findings)},
                    {"id": "confidence_score", "value": avg_conf},
                ],
            }
        }

        if self.mock_mode:
            logger.info("[MOCK] log_evaluation_event — use_case=%s violations=%d",
                        resolved_id, len(findings))
            return True

        endpoint = self._facts_endpoint(resolved_id)
        return await self.push_lifecycle_facts(endpoint, payload)

    async def log_human_override(
        self, finding_id: str, justification: str, user: str
    ) -> bool:
        payload: dict[str, Any] = {
            "entity": {
                "name": "Sentinel Automated Review",
                "description": f"Human override by {user} for finding {finding_id}: {justification}",
                "state": "completed",
                "system": "Sentinel-Spec-Engine",
                "metrics": [
                    {"id": "policy_violations", "value": 0},
                    {"id": "confidence_score", "value": 1.0},
                ],
            }
        }

        if self.mock_mode:
            logger.info("[MOCK] log_human_override — finding=%s user=%s", finding_id, user)
            return True

        endpoint = self._facts_endpoint(self.use_case_id)
        return await self.push_lifecycle_facts(endpoint, payload)
