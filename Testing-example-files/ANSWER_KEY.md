# Answer Key — Sentinel Spec Test Suite (for YOUR validation, not agent ingestion)

Keep this file out of whatever directory the agent scans — it's for
checking the agent's output against, not something it should retrieve.

## code/cloud_service.py
| ID | Flaw | Where |
|---|---|---|
| SEC-001 | Hardcoded webhook URL + bearer token | `OPS_NOTIFY_WEBHOOK`, `INTERNAL_BEARER_TOKEN` module constants |
| SEC-013 | `ibm_auth_token` / `ibm_jwt` hold AWS-key-shaped and GitHub-PAT-shaped values | `CloudClientRegistry.__init__` |
| TLS-001 | Silent plaintext fallback when `SENTINEL_ENFORCE_TLS` unset | `get_registry_endpoint()` |

## code/rag_pipeline.py
| ID | Flaw | Where |
|---|---|---|
| ADR-0017 | Raw direct Postgres connection string, no TLS, bypasses `governance-gateway` | `_direct_vector_db_connection_string()` |
| PATH-TRAVERSAL | Unsanitized path join, no containment check | `load_document()` |
| CONFIG-DRIFT | Local `LOCAL_MOCK_MODE` hardcoded, ignores global config | module-level constant |

## code/agent_mesh.py
| ID | Flaw | Where |
|---|---|---|
| TOKEN-STORAGE | Runtime tokens appended to `agent_debug.log` in plaintext | `_dump_runtime_token()` |
| DEBUG-OUTFLOW | Full stack trace + entire `os.environ` printed on request failure | `route_message()` except block |
| HARDCODED-ENDPOINT | Raw IP literal as API base (TEST-NET-3 range, safe placeholder) | `AGENT_MESH_BASE_URL` |

## code/billing_service.py (bonus — matches the product's own hero demo)
| ID | Flaw | Where |
|---|---|---|
| ADR-0042 | Direct call to `legacy_billing.charge()` instead of `billing_adapter.submit_charge()` | `finalize_checkout()` |

## Corpus docs the scanner should cite against
- `policy-corpus/ADR-0017-data-governance-gateway.md`
- `policy-corpus/ADR-0042-no-direct-legacy-billing.md`
- `policy-corpus/SEC-POLICY-credential-handling.md`

## Suggested pass/fail bar
- All 4 code files should each surface at least one `HIGH` confidence
  finding (≥85%) citing the correct corpus doc.
- `rag_pipeline.py`'s config-drift flaw is the softest signal on purpose —
  a good scanner should still flag it, just likely at `MEDIUM`/`WARNING`,
  not `HIGH`. If your agent misses it entirely, that's a retrieval-recall
  gap worth investigating; if it over-calls it `HIGH`, that's a
  confidence-calibration issue.
