"""adapters/local.py — Local mock compliance engine for offline / CI-test use.

Uses lightweight pattern matching against the 22-rule compliance matrix.
No IBM SDK dependencies — always available as a fallback.
"""
from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncGenerator

from domain.models import (
    AgentThinkingStep,
    CodeSnippet,
    ComplianceReport,
    ComplianceViolation,
)
from ports.ai_engine_port import AIEnginePort

# ---------------------------------------------------------------------------
# Static rule patterns (subset of the 22-rule matrix for offline detection)
# ---------------------------------------------------------------------------

_STATIC_RULES: list[dict] = [
    {
        "rule_id": "SEC-001",
        "severity": "CRITICAL",
        "patterns": [r"ibm_secret_access_key\s*=\s*['\"]", r"aws_secret_access_key\s*=\s*['\"]", r"AKIA[0-9A-Z]{16}"],
        "description": "Hard-coded cloud credential detected in source code.",
        "suggested_fix": "Remove the hard-coded credential and inject it at runtime via IBM Secrets Manager.",
    },
    {
        "rule_id": "SEC-002",
        "severity": "CRITICAL",
        "patterns": [r"api[_\-]?key\s*=\s*['\"][A-Za-z0-9\-_]{20,}['\"]"],
        "description": "Hard-coded API key string detected.",
        "suggested_fix": "Store API keys in environment variables or a managed secrets vault.",
    },
    {
        "rule_id": "SEC-003",
        "severity": "HIGH",
        "patterns": [r"execute\s*\(\s*f['\"]", r"execute\s*\(\s*\".*%s", r"cursor\.execute\s*\(.*\+"],
        "description": "Potential SQL injection: dynamic query construction detected.",
        "suggested_fix": "Use parameterised queries or a prepared statement ORM.",
    },
    {
        "rule_id": "SEC-004",
        "severity": "HIGH",
        "patterns": [r"os\.system\s*\(", r"subprocess\.call\s*\(.*shell\s*=\s*True", r"eval\s*\("],
        "description": "OS command injection vector detected.",
        "suggested_fix": "Avoid shell=True; use subprocess with a list of arguments and whitelist inputs.",
    },
    {
        "rule_id": "SEC-006",
        "severity": "HIGH",
        "patterns": [r"\.\./", r"open\s*\(.*\+.*\)", r"Path\s*\(.*input"],
        "description": "Potential path traversal — unsanitised user input used in file path construction.",
        "suggested_fix": "Resolve and validate paths against a trusted base directory before use.",
    },
    {
        "rule_id": "ARCH-001",
        "severity": "MEDIUM",
        "patterns": [r"from fastapi", r"from flask", r"from django", r"import fastapi", r"import flask"],
        "description": "Framework import detected inside domain layer — hexagonal domain leakage.",
        "suggested_fix": "Move framework imports to the adapter layer; the domain layer must remain framework-free.",
    },
    {
        "rule_id": "SEC-008",
        "severity": "HIGH",
        "patterns": [r"MD5\s*\(", r"hashlib\.md5", r"SHA1\s*\(", r"hashlib\.sha1", r"DES\.new"],
        "description": "Weak cryptographic algorithm (MD5/SHA-1/DES) detected.",
        "suggested_fix": "Replace with SHA-256 or stronger. For passwords, use bcrypt/argon2.",
    },
    {
        "rule_id": "SEC-013",
        "severity": "MEDIUM",
        "patterns": [r"ibm_.*=\s*['\"]AKIA"],
        "description": "Misleading variable naming: 'ibm_' prefixed variable holds an AWS key pattern.",
        "suggested_fix": "Rename the variable to reflect the actual cloud provider (e.g., 'aws_secret_access_key') or use a provider-agnostic name like 'cloud_secret_access_key'.",
    },
    {
        "rule_id": "SEC-012",
        "severity": "HIGH",
        "patterns": [r"logging\.info\s*\(.*password", r"print\s*\(.*password", r"logger\.(info|debug)\s*\(.*email"],
        "description": "PII or credential data potentially logged in plaintext.",
        "suggested_fix": "Redact sensitive fields before logging using a log sanitiser.",
    },
]


class LocalAIEngine(AIEnginePort):
    """Pattern-based offline compliance engine — no IBM SDK required."""

    def evaluate_code(self, code: CodeSnippet, filename: str | None = None) -> ComplianceReport:
        resolved_filename = filename or code.file_path
        violations = self._scan(code, resolved_filename)
        return ComplianceReport(
            is_compliant=not violations,
            violations=violations,
            metadata={"engine": "local", "mode": "mock", "file_path": code.file_path, "language": code.language},
            filename=resolved_filename,
        )

    async def evaluate_code_stream(
        self, code: CodeSnippet, filename: str | None = None
    ) -> AsyncGenerator[AgentThinkingStep, None]:
        resolved_filename = filename or code.file_path

        yield AgentThinkingStep(
            agent="system",
            phase="init",
            detail=f"Local rule engine engaged (offline/mock mode). Scanning `{resolved_filename}`.",
            payload={"filename": resolved_filename},
        )
        await asyncio.sleep(0)

        yield AgentThinkingStep(
            agent="classifier",
            phase="start",
            detail="Running static pattern classifier against 22-rule compliance matrix.",
            payload={"filename": resolved_filename},
        )
        await asyncio.sleep(0)

        violations = self._scan(code, resolved_filename)

        yield AgentThinkingStep(
            agent="classifier",
            phase="result",
            detail=f"Static scan complete. {len(violations)} violation(s) found.",
            payload={"violations_found": len(violations), "filename": resolved_filename},
        )

        for v in violations:
            yield AgentThinkingStep(
                agent="critic",
                phase="confirmed",
                detail=f"[{v.rule_id}] {v.description}",
                payload={"rule_id": v.rule_id, "severity": v.severity, "verdict": "confirmed", "filename": resolved_filename},
            )
            await asyncio.sleep(0)

        report = ComplianceReport(
            is_compliant=not violations,
            violations=violations,
            metadata={"engine": "local", "mode": "mock"},
            filename=resolved_filename,
        )
        yield AgentThinkingStep(
            agent="system",
            phase="complete",
            detail="Local analysis complete." if report.is_compliant else f"{len(violations)} violation(s) detected.",
            payload={
                "is_compliant": report.is_compliant,
                "filename": resolved_filename,
                "violations": [
                    {"rule_id": v.rule_id, "severity": v.severity, "description": v.description, "filename": v.filename}
                    for v in violations
                ],
            },
        )

    def _scan(self, code: CodeSnippet, filename: str) -> list[ComplianceViolation]:
        violations: list[ComplianceViolation] = []
        lines = code.content.splitlines()
        for rule in _STATIC_RULES:
            rule_matched = False
            for pattern in rule["patterns"]:
                if rule_matched:
                    break
                compiled = re.compile(pattern, re.IGNORECASE)
                for line_no, line in enumerate(lines, start=1):
                    if compiled.search(line):
                        violations.append(
                            ComplianceViolation(
                                rule_id=rule["rule_id"],
                                severity=rule["severity"],
                                line_number=line_no,
                                description=rule["description"],
                                suggested_fix=rule["suggested_fix"],
                                confidence=0.90,
                                filename=filename,
                            )
                        )
                        rule_matched = True
                        break  # one violation per rule per file
        return violations
