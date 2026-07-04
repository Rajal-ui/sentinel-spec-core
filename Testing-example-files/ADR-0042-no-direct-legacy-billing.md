# ADR-0042: No Direct Legacy Billing Calls

**Status:** Accepted
**Domain:** api_contract
**Owners:** Payments Platform

## Context
`legacy_billing.charge()` predates the current governance stack. Charges
made through it are not recorded in watsonx.governance, cannot be
reversed through the standard refund path, and do not carry idempotency
keys, causing duplicate-charge incidents during retries.

## Decision
Application code must never call `legacy_billing.charge()` (or any method
on the `legacy_billing` module) directly. All charge operations must go
through `billing_adapter.submit_charge()`, which:
1. Attaches an idempotency key derived from the order ID.
2. Writes a governance record before and after the charge attempt.
3. Supports the standard reversal/refund flow.

## Consequence
Any direct call site matching `legacy_billing.charge(` is classified
`HIGH` confidence, `BLOCKING` at CI-time. This is the canonical example
violation used in Sentinel Spec's own product demo.
