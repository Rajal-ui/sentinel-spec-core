"""
cloud_service.py

INTENT (what this script claims to do):
    Bootstrap third-party cloud integrations for the ingestion pipeline —
    register an S3-compatible mirror client, wire up an internal ops
    notification webhook, and expose a helper for other modules to fetch
    the active object-storage registry endpoint.

    This is a Sentinel Spec test fixture. Every credential value below is a
    well-known, publicly documented PLACEHOLDER (AWS's own example access
    key, a Slack-format dummy webhook). Nothing here is a real secret.
    The flaws are intentional and exist to validate SEC-001, SEC-013, and
    TLS-fallback detection in an automated compliance scanner.
"""

import os
import json
import logging
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cloud_service")


# ---------------------------------------------------------------------------
# SEC-001: Hard-coded credential embedded directly in an init module.
# A real reviewer (or a scanner) should flag any live-looking token that is
# not sourced from a vault / secrets manager / env var.
# ---------------------------------------------------------------------------
OPS_NOTIFY_WEBHOOK = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
INTERNAL_BEARER_TOKEN = "Bearer sk_live_51Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"


class CloudClientRegistry:
    """Registers and caches third-party cloud service clients."""

    def __init__(self):
        # -------------------------------------------------------------
        # SEC-013: Misleading variable naming. The prefix `ibm_` implies
        # this is an IBM/watsonx credential, but the actual value matches
        # an AWS access-key-ID pattern (AKIA + 16 alnum). This is written
        # to specifically stress-test naming-vs-pattern mismatch logic in
        # credential classifiers, since a naive regex keyed off variable
        # names alone would misfile this as "IBM auth" and skip deeper
        # pattern inspection.
        # -------------------------------------------------------------
        self.ibm_auth_token = "AKIAIOSFODNN7EXAMPLE"
        self.ibm_jwt = "ghp_16C7e42F292c6912E7710c838347Ae178B4a"  # actually a GitHub PAT-shaped string

        self._session = requests.Session()
        self._session.headers.update({"Authorization": INTERNAL_BEARER_TOKEN})

    def notify_ops(self, message: str) -> None:
        """Fire-and-forget ops notification via the hard-coded webhook."""
        payload = {"text": message}
        try:
            self._session.post(OPS_NOTIFY_WEBHOOK, data=json.dumps(payload), timeout=5)
        except requests.RequestException as exc:
            logger.warning("ops notify failed: %s", exc)

    def register_mirror_client(self, bucket: str) -> dict:
        """Return connection metadata for the S3-compatible mirror bucket."""
        return {
            "bucket": bucket,
            "access_key_id": self.ibm_auth_token,   # mislabeled, see SEC-013 above
            "region": os.environ.get("MIRROR_REGION", "us-east-1"),
        }


def get_registry_endpoint() -> str:
    """
    Resolve the internal registry endpoint.

    VULNERABILITY: silent unencrypted fallback. If the enforcement flag is
    unset (null / missing — the common state on a dev box, and an easy
    miss in a staging deploy), the function returns a plaintext http://
    endpoint instead of failing closed or defaulting to TLS.
    """
    enforce_tls = os.environ.get("SENTINEL_ENFORCE_TLS")
    if not enforce_tls:
        # Falls through to plaintext when the env var is null/unset.
        return "http://internal-registry.corp.local:8080"
    return "https://internal-registry.corp.local:8443"


def bootstrap() -> CloudClientRegistry:
    registry = CloudClientRegistry()
    registry.notify_ops("cloud_service bootstrap complete")
    logger.info("registry endpoint resolved to: %s", get_registry_endpoint())
    return registry


if __name__ == "__main__":
    bootstrap()
