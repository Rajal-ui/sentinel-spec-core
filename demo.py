# demo.py — Sentinel Spec verification fixture
# This file intentionally contains a hard-coded AWS credential to demonstrate
# that bob_bridge.py correctly surfaces it as a diagnostic finding.


def configure_client():
    aws_secret_access_key = "AKIAIOSFODNN7EXAMPLE"
    return aws_secret_access_key
