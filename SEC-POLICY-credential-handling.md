# Security Policy: Credential Handling & Transport Encryption

**Status:** Accepted
**Domain:** security
**Owners:** Platform Security

## SEC-001 — No Hard-Coded Credentials
No literal API key, token, webhook URL containing a token, or password may
appear in source code, including in "internal" bootstrap or init modules.
All credentials must be resolved at runtime from the secrets manager or an
environment variable populated by the deployment pipeline. This applies
regardless of whether the surrounding code is reachable in production.

## SEC-013 — Variable Naming Must Match Credential Provenance
A variable's name must accurately reflect the credential type and issuer it
holds (e.g. a name prefixed `ibm_` or `watsonx_` must hold a credential
actually issued by IBM/watsonx, not a value matching an AWS access key,
GitHub PAT, or Azure connection string pattern). Mismatched naming is
treated as an aggravating factor on top of the underlying SEC-001 finding,
since it defeats naive "trusted prefix" allow-lists and indicates an
attempt (intentional or accidental) to obscure the credential's real
source.

## TLS-001 — No Silent Plaintext Fallback
Any function resolving a service endpoint must fail closed (raise, or
default to the encrypted endpoint) when a TLS-enforcement flag is unset or
null. Falling through to an `http://` endpoint when a feature flag is
missing is a `BLOCKING` finding — an unset flag is not evidence that TLS
enforcement is intentionally disabled.

## Consequence
SEC-001 and TLS-001 findings are `BLOCKING` at CI-time. SEC-013 is
`WARNING` standalone, escalated to `BLOCKING` when co-located with a
SEC-001 finding in the same file.
