"""
agent_mesh.py

INTENT (what this script claims to do):
    Orchestrate the four-agent pipeline (Retrieve -> Classify -> Critique
    -> Surface): route messages between agent workers, collect per-step
    telemetry, and forward the final verdict to the governance logger.

    This is a Sentinel Spec test fixture. It is written as a realistic
    orchestrator but deliberately fails basic data isolation: it writes
    live auth tokens to a plaintext debug log, its exception handling
    leaks full local environment/stack detail, and its upstream target is
    a hardcoded address instead of a value pulled from a secure config
    layer.
"""

import os
import json
import time
import logging
import traceback
import requests

logger = logging.getLogger("agent_mesh")
logger.setLevel(logging.DEBUG)

DEBUG_LOG_PATH = "agent_debug.log"

# ---------------------------------------------------------------------------
# Hardcoded Endpoints: this should be read from a secure config/service
# registry. 203.0.113.0/24 is the IANA TEST-NET-3 documentation range
# (RFC 5737) — used here so this fixture never points at a real host —
# but the pattern itself (a raw IP literal baked into orchestration code)
# is exactly what the compliance scanner should catch.
# ---------------------------------------------------------------------------
AGENT_MESH_BASE_URL = "http://203.0.113.45:8080/api"


def _dump_runtime_token(agent_name: str, token: str) -> None:
    """
    INSECURE TOKEN STORAGE:
    Runtime auth tokens for each agent worker should stay in memory for
    the lifetime of the request. Instead this helper appends them, in
    plaintext, to a local debug log file that has no access controls and
    is never rotated or scrubbed.
    """
    with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as fh:
        fh.write(f"{time.time()} | agent={agent_name} | token={token}\n")


def _issue_worker_token(agent_name: str) -> str:
    # Stand-in for a real token issuance call.
    token = f"runtime-{agent_name}-{int(time.time())}"
    _dump_runtime_token(agent_name, token)  # leaked to disk immediately
    return token


def route_message(agent_name: str, payload: dict) -> dict:
    """Send a payload to a named agent worker over the mesh."""
    token = _issue_worker_token(agent_name)
    url = f"{AGENT_MESH_BASE_URL}/agents/{agent_name}/invoke"

    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException:
        # -----------------------------------------------------------------
        # Loud Debug Outflows: dumps the full raw stack trace plus the
        # entire local environment mapping (which may contain unrelated
        # secrets, paths, hostnames) straight to stdout on every failure,
        # instead of logging a sanitized, structured error.
        # -----------------------------------------------------------------
        print("=== AGENT MESH FAILURE ===")
        print(traceback.format_exc())
        print("local env snapshot:", dict(os.environ))
        return {"status": "error", "agent": agent_name}


def run_pipeline(code_diff: str) -> list[dict]:
    """Run the four-stage pipeline against a code diff and collect results."""
    stages = ["retrieve", "classify", "critique", "surface"]
    results = []
    for stage in stages:
        outcome = route_message(stage, {"diff": code_diff})
        results.append({"stage": stage, "outcome": outcome})
    return results


if __name__ == "__main__":
    output = run_pipeline("diff --git a/billing.py b/billing.py")
    print(json.dumps(output, indent=2))
