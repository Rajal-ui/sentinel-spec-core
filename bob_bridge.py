"""bob_bridge.py — Execution bridge between IBM Bob IDE and the Sentinel Spec engine.

Usage (Bob terminal / agent watcher):
    python bob_bridge.py <workspace_file_path>

Stdout: a JSON array of Bob structured diagnostics findings.
Stderr: human-readable error messages (engine warnings, fallback notices).
Exit codes:
    0 — analysis completed (findings may or may not be present)
    1 — bridge initialisation / invocation error (bad args, missing file)

Error-resiliency contract
-------------------------
If the IBM Watsonx engine cannot initialise (missing credentials, _setup_error,
or any runtime exception), the bridge silently falls back to LocalAIEngine so
Bob's diagnostic pipeline always receives a valid JSON array on stdout.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def _detect_language(file_path: Path) -> str:
    return {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".java": "java",
        ".go": "go",
        ".rb": "ruby",
        ".cs": "csharp",
        ".cpp": "cpp",
        ".c": "c",
        ".sh": "shell",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".json": "json",
        ".tf": "terraform",
    }.get(file_path.suffix.lower(), "plaintext")


def _build_findings(report) -> list[dict]:
    return [
        {
            "id": v.rule_id,
            "message": v.description,
            "line": v.line_number,
            "severity": v.severity,
            "fix": v.suggested_fix,
        }
        for v in report.violations
    ]


def _resolve_engine(snippet):
    """Return (engine, report) using IBM engine when healthy, LocalAIEngine otherwise.

    Never raises — all IBM initialisation and evaluation errors are caught here
    so the caller always receives a usable ComplianceReport.
    """
    from adapters.ibm import IBMAIEngine
    from adapters.local import LocalAIEngine

    ibm = IBMAIEngine()

    # Guard 1: credentials missing or SDK rejected the setup.
    if ibm._setup_error or ibm._model is None:
        reason = ibm._setup_error or "missing_environment_configuration"
        print(
            f"bob_bridge: warning: IBM engine unavailable ({reason}); "
            "falling back to local rule engine",
            file=sys.stderr,
        )
        return LocalAIEngine().evaluate_code(snippet)

    # Guard 2: live evaluation may still raise (network, quota, parse errors).
    try:
        return ibm.evaluate_code(snippet)
    except Exception as exc:
        print(
            f"bob_bridge: warning: IBM engine evaluation failed ({exc}); "
            "falling back to local rule engine",
            file=sys.stderr,
        )
        return LocalAIEngine().evaluate_code(snippet)


def main() -> None:
    if len(sys.argv) < 2:
        print("bob_bridge: error: no file path supplied (expected sys.argv[1])", file=sys.stderr)
        sys.exit(1)

    target = Path(sys.argv[1])

    if not target.exists():
        print(f"bob_bridge: error: file not found: {target}", file=sys.stderr)
        sys.exit(1)

    # Domain imports deferred so SDK initialisation only runs for valid invocations.
    from domain.models import CodeSnippet

    content = target.read_text(encoding="utf-8", errors="replace")
    snippet = CodeSnippet(
        content=content,
        file_path=str(target),
        language=_detect_language(target),
    )

    report = _resolve_engine(snippet)
    findings = _build_findings(report)
    print(json.dumps(findings, indent=2))


if __name__ == "__main__":
    main()
