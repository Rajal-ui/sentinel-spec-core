from __future__ import annotations

import os
from typing import Final

from adapters.ibm import IBMAIEngine
from adapters.local import LocalAIEngine
from domain.models import CodeSnippet
from ports.ai_engine_port import AIEnginePort


DEFAULT_MOCK_MODE: Final[str] = "true"


def bootstrap_engine(mock_mode: bool) -> AIEnginePort:
    if mock_mode:
        return LocalAIEngine()
    return IBMAIEngine()


def main() -> None:
    mock_mode_value = os.getenv("MOCK_MODE", DEFAULT_MOCK_MODE).strip().lower()
    mock_mode = mock_mode_value not in {"false", "0", "no", "off"}

    engine = bootstrap_engine(mock_mode)

    sample_code = CodeSnippet(
        content="def configure_client():\n    ibm_secret_access_key = 'AKIAIOSFODNN7EXAMPLE'\n    return ibm_secret_access_key",
        file_path="demo.py",
        language="python",
    )

    report = engine.evaluate_code(sample_code)

    print(f"Bootstrapped engine: {type(engine).__name__}")
    print(f"Compliance status: {'compliant' if report.is_compliant else 'violations detected'}")

    for violation in report.violations:
        print(
            f"- {violation.rule_id} [{violation.severity}] line {violation.line_number}: {violation.description}"
        )
        print(f"  Suggested fix: {violation.suggested_fix}")


if __name__ == "__main__":
    main()
