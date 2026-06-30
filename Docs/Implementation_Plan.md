# Implementation Plan
## Sentinel Spec — Autonomous Architecture & Compliance Reviewer

| | |
|---|---|
| **Status** | Draft v1.0 |
| **Related docs** | PRD — Sentinel Spec, TRD — Sentinel Spec |

This plan expands the three-phase roadmap into concrete, sequenced workstreams. Each phase lists its goal, scope boundary (what's deliberately excluded), task breakdown, and exit criteria — the gate that must pass before moving to the next phase.

---

## Phase 1 — Proof of Concept
**Target duration:** 2–3 weeks · **Scope:** single repo, single policy domain, no enforcement, no governance logging

### Goal
Prove the core loop works end to end: Bob surfaces a correctly-cited, accurate inline finding for a real policy violation, with zero context switch, in under 5 seconds.

### Explicitly excluded from Phase 1
- CI-gate enforcement (advisory only)
- watsonx.governance integration
- watsonx Orchestrate hosting (use a bare FastAPI service instead)
- Watson Discovery automated ingestion (hand-curate documents)
- Multi-tenant scoping
- Override workflow

### Tasks

1. **Policy corpus seed.** Hand-curate 15–20 ADRs/policies for one real repository. Pick a security-sensitive domain (PII handling or a known legacy-service boundary) for maximum demo clarity. Store as plain markdown files.
2. **Embedding pipeline (manual).** Write a one-off script to chunk and embed the seed corpus into a local pgvector instance. No Watson Discovery yet — this is the fastest path to a working retrieval layer.
3. **AST Parser & Diff Extractor (minimal).** Implement for one language only (recommend Python, fastest to stand up via `tree-sitter-python`). Output `CodeChangeUnit` objects per TRD Section 3.1
4. **Policy Retrieval Agent.** Implement `PolicyRetrievalPort` against the local pgvector store. No production embedding-model concerns yet — pick any consistent embedding model and move on.
5. **Violation Classification Agent (single-stage, no Critic yet).** Implement the Granite classifier prompt from TRD Section 3.3. Skip the Adversarial Critic for Phase 1 — accept a higher false-positive rate in exchange for speed to demo; this is the single most deliberate scope cut in the whole plan.
6. **Minimal MCP server.** Expose `check_architecture_conformance(diff)` only. Wire it into Bob per IBM's documented MCP-server-to-Bob pattern.
7. **Bob Findings integration.** Confirm findings render correctly in the native Bob Findings panel — this is the actual "zero context switch" deliverable and should be tested with a real developer, not just the builder.
8. **Demo script.** Prepare a reproducible demo: a real PR-style change that triggers a real, correctly-cited violation against the seed corpus.

### Exit Criteria
- [ ] Live demo: Bob flags a real violation inline, in-editor, with a correct citation to a specific ADR, in under 5 seconds.
- [ ] Retrieval precision spot-checked manually against at least 10 test diffs (5 should violate policy, 5 should not) — document the false-positive/false-negative count honestly; this baseline number is what Phase 2's Critic is built to improve.
- [ ] No auth system, no multi-tenancy, no UI beyond what Bob already provides — confirm scope discipline was held.

---

## Phase 2 — Hardened Reviewer
**Target duration:** 4–6 weeks · **Scope:** multi-policy-domain, CI-gated, governance-logged

### Goal
Move from "interesting demo" to "trustworthy enough to gate real merges." This phase's defining metric is false-positive rate, tracked explicitly throughout, not just at the end.

### Explicitly excluded from Phase 2
- Multi-tenant policy scoping (still single shared corpus)
- Engineering Manager dashboard (raw governance logs are queryable but not yet visualized)
- Auto-remediation suggestions as reviewable diffs (findings explain the problem; suggested-fix diffs come in Phase 3)

### Tasks

1. **Adversarial Compliance Critic.** Implement per TRD Section 3.4 as a genuinely separate model invocation. Build a small labeled eval set (real or synthetic violations + non-violations) to measure the Critic's effect on false-positive rate before/after — this number goes directly into the PRD's launch-readiness gate.
2. **Confidence banding & routing logic.** Implement `route_finding` per TRD Section 3.6. Decide and document the initial confidence thresholds; treat them as tunable parameters, not hardcoded constants — they will need adjustment once real usage data comes in.
3. **watsonx Orchestrate migration.** Move agent hosting off the bare FastAPI service onto Orchestrate as the real control plane. This is also where the CI-time invocation path gets built for the first time — confirm the *exact same* DAG code path serves both IDE-time and CI-time triggers (per TRD Architecture Principle 2 — defense in depth depends on this not drifting into two separate implementations).
4. **CI gate implementation.** Wire a blocking GitHub Actions/Tekton check that calls the Orchestrate-hosted pipeline against the final PR diff. Implement the fail-open behavior specified in TRD Section 7 — test this explicitly (kill the pipeline mid-CI-run and confirm merges aren't blocked org-wide).
5. **watsonx.governance integration.** Implement the lineage record schema from TRD Section 5.1. Every classification, every Critic verdict, every routing decision gets logged — this is also the point to validate that a compliance-officer-style query ("show me every PII-policy violation last month") is actually answerable from the logs, not just theoretically possible.
6. **Policy corpus expansion.** Grow from 1 to 3–4 domains (security, data residency, API contract conformance, a legacy-service boundary rule) to prove retrieval generalizes — this is a real risk to validate, not a formality; a corpus tuned to one domain's document style may retrieve poorly against a differently-structured policy doc.
7. **Watson Discovery integration.** Replace Phase 1's manual embedding script with automated ingestion, so new/updated policy documents are indexed without a manual pipeline run. Validate the "no retraining cycle" claim from TRD Architecture Principle 5 — update one ADR, confirm the next query reflects it.
8. **Override workflow (basic).** Implement `submit_override` per TRD Section 6 — developer can override a blocking finding with required justification, logged against identity. Defer the approval-chain question (PRD Open Question 3) to a deliberate decision before this ships, not an afterthought.

### Exit Criteria
- [ ] False-positive override rate measured against real usage (even a small pilot) at or trending toward the PRD's <5% target.
- [ ] CI gate demonstrably blocks a real high-confidence violation and demonstrably fails open when the pipeline is unavailable (both tested, not assumed).
- [ ] A compliance-style query is answered live from governance logs with no manual log-digging.
- [ ] Policy corpus spans 3–4 domains with retrieval quality spot-checked across all of them, not just the original Phase 1 domain.

---

## Phase 3 — Enterprise-Ready Platform
**Target duration:** 8–12 weeks · **Scope:** multi-repo, multi-tenant, audit-grade, security-hardened

### Goal
Generalize from "works for one team on one repo" to a platform other teams can onboard themselves to, with the security posture to support write-adjacent capabilities.

### Tasks

1. **Multi-repo support.** Generalize the diff-extraction and CI-gate wiring to work across an arbitrary set of repos, not one hardcoded target.
2. **Multi-tenant policy scoping.** Implement the `team_scope` filtering approach from TRD Section 9 (single-table-with-filter, per the TRD's recommendation) — apply the same Port-boundary isolation discipline used elsewhere in this architecture pattern, not just a query-level convenience filter.
3. **Engineering Manager dashboard.** Build the violation-trend visualization (FR10) on top of the existing governance logs and Event Streams data — correlate with Bobalytics data per the original architecture's "single pane of glass" goal rather than building a disconnected second dashboard.
4. **Override approval chain.** Resolve PRD Open Question 3 and implement it — likely a second-approver requirement for high-confidence-finding overrides, self-serve for lower-tier ones.
5. **Auto-remediation as reviewable diffs.** Implement the Remediation Explainer Agent's suggested-fix output as an actual reviewable diff surfaced through Bob's Literate Coding mode (review-before-apply), per PRD FR12 — confirm this never silently auto-applies, this is a hard constraint, not a default to be loosened later without a separate decision.
6. **Security review of the Sentinel Spec MCP server.** Dedicated review before enabling any write-adjacent capability — specifically test for prompt-injection-via-code-comment or diff-content attack vectors, given the precedent of Bob's own disclosed pre-GA CLI-manipulation issue. This gate is non-negotiable per TRD Section 8 and should be run by someone other than the implementing engineer.
7. **Onboarding documentation & self-serve corpus setup.** Document how a new team adds their own ADR corpus, sets confidence thresholds, and gets their repo wired into the CI gate — this is what makes it a platform rather than a one-off integration.
8. **Quarterly policy corpus review process.** Stand up the ownership process flagged in PRD Risk mitigation — assign an owner, define a cadence, confirm stale-policy risk has a real mitigation, not just a documented intention.

### Exit Criteria
- [ ] At least one additional team successfully onboards using only the self-serve documentation, without direct help from the original build team.
- [ ] Security review completed and sign-off obtained before any write-adjacent capability is enabled in production.
- [ ] Dashboard in active use by at least one Engineering Manager for a real prioritization decision.
- [ ] Override approval chain resolved and enforced, not left as an open question.

---

## Cross-Phase Tracking

| Metric | Phase 1 baseline | Phase 2 target | Phase 3 target |
|---|---|---|---|
| False positive rate | Measured, documented (no target — establishing baseline) | <5% | <5%, sustained across multiple teams |
| Violations caught pre-PR vs. at-review | Not yet measured | >60% | >60%, sustained |
| Repos covered | 1 | 1 | Multiple, self-serve onboarding |
| Policy domains covered | 1 | 3–4 | Extensible, team-defined |
