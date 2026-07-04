# ADR-0017: Data Governance Gateway Mandate

**Status:** Accepted
**Domain:** data_residency
**Owners:** Platform Security, Data Governance

## Context
Services across the platform were connecting directly to external data
stores (vector databases, analytics warehouses, third-party caches) using
raw connection strings. This bypassed TLS enforcement, query auditing, and
tenant isolation, and made it impossible to produce a governance trail for
what data left the tenancy and where it went.

## Decision
All connections from application code to any external or third-party
managed data store **must** be routed through the corporate
`governance-gateway` service. Raw, direct connection strings to external
hosts are prohibited in production and staging code paths.

Specifically, a connection is compliant only if:
1. It is issued through `governance_gateway.connect(...)`, not constructed
   inline (no `f"postgresql://...`, `mongodb://...`, etc. literals).
2. TLS/mTLS is enforced end to end — no `sslmode=disable` or plaintext
   equivalents.
3. Credentials are resolved from the secrets manager at connect time, never
   embedded as string literals or default parameter values.

## Consequence
Violations are classified `BLOCKING` at CI-time and `WARNING` at IDE-time.
A direct connection string literal targeting a host outside
`*.corp.internal` is treated as strong evidence of a violation regardless
of surrounding comments or variable naming.
