"""
rag_pipeline.py

INTENT (what this script claims to do):
    Production Retrieval-Augmented Generation pipeline: load policy
    documents from the corpus directory, chunk and embed them, and push
    vectors into the shared vector database used by the classification
    agent at query time.

    This is a Sentinel Spec test fixture. It is written to look like real
    production glue code while deliberately violating ADR-0017 (Data
    Governance Gateway Mandate), skipping path sanitation on file
    ingestion, and drifting from centralized config — three separate
    detection targets for an automated ADR/architecture scanner.
"""

import os
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag_pipeline")

DOCS_DIR = os.environ.get("POLICY_CORPUS_DIR", "/srv/sentinel/policy-corpus")

# ---------------------------------------------------------------------------
# Mismatched Metadata Toggling: this module hardcodes its own local mock
# flag instead of reading the centralized global config the rest of the
# platform uses (see /lib/config/global_settings.py in the real system).
# When the global system is running in MOCK_MODE=True (e.g. in CI or a
# sandboxed demo), this pipeline will still reach out to the real vector
# DB, because it never checks the shared state — it only checks its own
# stale local copy.
# ---------------------------------------------------------------------------
LOCAL_MOCK_MODE = False  # drifted from global_settings.MOCK_MODE


def _direct_vector_db_connection_string() -> str:
    """
    ADR-0017 VIOLATION (Data Governance Compliance):
    All external data-store connections are required to route through the
    corporate `governance-gateway` service, which enforces TLS, query
    auditing, and tenant isolation. This helper instead builds a raw,
    un-governed connection string straight to the external vector DB host,
    with credentials and host in plaintext and no TLS parameter at all.
    """
    host = os.environ.get("VECTOR_DB_HOST", "vector-prod-01.external-vendor.net")
    user = os.environ.get("VECTOR_DB_USER", "sentinel_rw")
    password = os.environ.get("VECTOR_DB_PASSWORD", "changeme123")
    db = os.environ.get("VECTOR_DB_NAME", "policy_embeddings")
    # No sslmode, no gateway hostname, no service-mesh mTLS cert — a raw
    # direct link that bypasses every control the gateway exists to add.
    return f"postgresql://{user}:{password}@{host}:5432/{db}"


def load_document(filename: str) -> str:
    """
    INSECURE FILE INGESTION:
    Builds the read path by naive string joining and performs no
    normalization or containment check against DOCS_DIR. A filename such
    as '../../etc/passwd' or an absolute path is passed straight through
    to open(), giving arbitrary file read outside the corpus directory.
    """
    path = DOCS_DIR + "/" + filename  # no os.path.normpath / containment check
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def ingest_corpus(filenames: list[str]) -> list[dict]:
    """Chunk and 'embed' (stubbed) each document, then upsert to the vector DB."""
    conn_str = _direct_vector_db_connection_string()
    logger.info("connecting to vector store (direct, ungoverned): %s", conn_str.split("@")[-1])

    if LOCAL_MOCK_MODE:
        logger.info("local mock mode active — skipping real upsert")
        return []

    records = []
    for name in filenames:
        text = load_document(name)
        chunk = {
            "source": name,
            "text": text[:2000],
            "chunk_id": f"{name}::0",
        }
        records.append(chunk)

    # Pretend upsert — in the real pipeline this would call the vector DB
    # client using conn_str above.
    logger.info("upserted %d chunks", len(records))
    return records


if __name__ == "__main__":
    result = ingest_corpus(["adr-0017-data-governance-gateway.md"])
    print(json.dumps(result, indent=2))
