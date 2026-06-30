# Product Requirements Document (PRD)
## Sentinel Spec — Autonomous Architecture & Compliance Reviewer

| | |
|---|---|
| **Status** | Draft v1.0 |
| **Owner** | TBD |
| **Stakeholders** | Engineering Leadership, Security/Compliance, DevEx |
| **Related docs** | TRD — Sentinel Spec, Implementation Plan — Sentinel Spec |

---

## 1. Problem Statement

Engineering teams using AI-accelerated coding tools (IBM Bob, Copilot, etc.) generate code faster than human reviewers can verify it against organizational architecture decisions and compliance policy. The knowledge needed to catch violations — ADRs, security policy, data-residency rules, internal API contracts — exists, but lives in scattered documents and tribal memory, and is only checked (inconsistently) at PR-review time, by which point the cost of rework is already sunk.

This causes three concrete, measurable problems today:

1. **Late-cycle rework.** Architecture/policy violations caught at PR review require the author to re-context-switch back into code they've mentally moved on from, increasing both fix time and the chance the fix introduces a new violation.
2. **Inconsistent enforcement.** Whether a violation is caught depends on which reviewer happens to remember the relevant ADR — enforcement quality is a function of individual reviewer memory, not a governed system.
3. **No audit evidence.** When an auditor (SOC2, ISO27001, internal) asks "how do you ensure architectural/compliance conformance," the honest answer today is "a human reviewer, sometimes." There is no queryable record of what was checked, against what policy, with what outcome.

## 2. Goals

| Goal | Success looks like |
|---|---|
| G1 — Shift detection left | Policy/architecture violations are surfaced to the developer inside the IDE, before a PR is opened |
| G2 — Make enforcement consistent | The same policy corpus is checked identically regardless of which human reviewer is assigned |
| G3 — Produce auditable evidence | Every check, citation, and override is recorded as an immutable, queryable lineage record |
| G4 — Preserve developer trust and flow | False-positive rate stays low enough that developers don't learn to ignore or disable the tool |
| G5 — Never silently block without recourse | Every blocking decision has a clear, fast human-override path |

## 3. Non-Goals

- Sentinel Spec is **not** a general code-quality or style linter (that's already handled by existing tooling and Bob's native findings).
- Sentinel Spec does **not** auto-merge or auto-deploy code; it gates and advises, it does not act autonomously on the codebase beyond suggesting reviewable remediations.
- Sentinel Spec does **not** replace human architectural review entirely — it removes the *rote, rule-checking* portion of review so human reviewers can focus on judgment calls.
- v1 does **not** attempt fine-tuning a custom model; all reasoning is RAG-grounded prompting over Granite (see TRD for rationale).

## 4. Target Users & Personas

| Persona | Need |
|---|---|
| **Individual Contributor Engineer** | Wants to know *while coding* if they're about to violate a known rule, with a clear explanation and fix — not a vague "this might be wrong" |
| **Senior Architect / Tech Lead** | Wants their hard-won architectural decisions enforced consistently without personally reviewing every PR for the same recurring violations |
| **Security/Compliance Officer** | Wants queryable, exportable evidence that policy conformance is being checked, for audit purposes |
| **Engineering Manager** | Wants visibility into violation trends by team/repo to identify where training or ADR clarification is needed |

## 5. User Stories

1. As an IC, while writing code in Bob, I want to see inline findings (in the existing Bob Findings panel) when my change conflicts with a known architecture decision, so I can fix it before I even open a PR.
2. As an IC, when a finding is flagged, I want a clear citation to the specific policy/ADR and a suggested remediation, so I'm not left guessing what's wrong or why.
3. As an IC, if I believe a finding is a false positive, I want a fast, logged override path that doesn't block me indefinitely.
4. As a Tech Lead, I want high-confidence violations to block PR merge via CI, so the rule is actually enforced and not just suggested.
5. As a Compliance Officer, I want to query "show me every violation and override related to PII-handling policy in the last quarter" and get a complete, trustworthy answer.
6. As an Engineering Manager, I want a dashboard showing violation trends by repo/team/policy-domain, so I can identify systemic gaps (e.g., "Team X keeps violating the idempotency-gateway rule — maybe the ADR needs to be clearer, or needs a training session").

## 6. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR1 | System ingests and indexes ADR/policy documents from a defined source (initially manual upload, later Watson Discovery-automated) | P0 |
| FR2 | System retrieves relevant policy context for a given code diff via RAG | P0 |
| FR3 | System classifies whether a diff violates retrieved policy, with a mandatory citation to the specific source chunk | P0 |
| FR4 | System runs a second, adversarial verification pass before any finding is marked "blocking" | P0 |
| FR5 | Findings surface natively inside IBM Bob's existing Bob Findings panel via MCP, with zero additional UI to learn | P0 |
| FR6 | High-confidence findings block PR merge via a CI gate; medium-confidence findings warn only; low-confidence findings log only | P0 |
| FR7 | Every classification, citation, and human override is logged as an immutable record queryable later | P0 |
| FR8 | Developers can override a blocking finding with a required justification, logged against their identity | P1 |
| FR9 | When a policy document is updated, the system reflects the change on next query without a retraining cycle | P1 |
| FR10 | Engineering Manager dashboard surfaces violation trends by repo, team, and policy domain | P1 |
| FR11 | System supports multiple, isolated policy corpora per team/business unit (multi-tenant policy scoping) | P2 |
| FR12 | Auto-suggested remediations are presented as a reviewable diff (never silently auto-applied) | P1 |

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Latency** | IDE-time (advisory) findings return in under 5 seconds for a typical diff, to avoid breaking developer flow |
| **False positive rate** | Target under 5% of blocking findings overturned via override in steady state (post-Phase 2 tuning); tracked explicitly as a launch-readiness metric |
| **Auditability** | Every record in the governance log is immutable and includes: timestamp, actor, diff reference, policy citation(s), confidence score, decision, and any override justification |
| **Data isolation** | Policy corpora and embeddings remain inside the customer's own IBM Cloud tenancy; no proprietary architecture knowledge is used to train any shared/external model |
| **Availability** | CI-gate check (the actual enforcement boundary) must degrade gracefully — if the agent pipeline is unavailable, the gate fails *open* with a logged warning, not silently blocking all merges org-wide (explicit decision — see Open Questions) |
| **Security** | MCP tool permissioning for Sentinel Spec is scoped to read-diff and write-finding only in Phase 1–2; any write-adjacent auto-remediation capability requires a dedicated security review before enabling (Phase 3) |

## 8. Success Metrics

| Metric | Target by end of Phase 2 |
|---|---|
| Violations caught pre-PR vs. at-PR-review | >60% caught pre-PR (IDE-time) |
| False positive override rate | <5% |
| Time-to-fix for caught violations | Reduced by >50% vs. baseline (PR-review-time fixes) |
| Audit query response | Any compliance officer query answerable from governance logs with no manual log-digging |
| Developer satisfaction (survey) | Net positive sentiment on "Sentinel Spec helps more than it interrupts" |

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Developers learn to ignore/disable findings due to noise | Confidence-banding (FR6) keeps only high-confidence findings blocking; false-positive rate is a tracked launch gate, not an afterthought |
| Policy corpus goes stale, system enforces outdated rules | FR9 — re-indexing on document update; quarterly policy corpus review owned by architecture team |
| Over-reliance leads to atrophied human architectural judgment | Sentinel Spec is explicitly positioned as removing rote-rule-checking from review, not replacing judgment calls — human review remains required for non-policy architectural quality |
| Single point of failure blocks all merges org-wide | NFR: CI gate fails open with logged warning, not closed (see Open Questions for the explicit tradeoff this accepts) |
| Security vulnerability in the MCP server itself (cf. Bob's disclosed pre-GA CLI-manipulation issue) | Phase 3 mandates a dedicated security review before any write-adjacent capability ships |

## 10. Open Questions

1. **Fail-open vs. fail-closed CI gate:** this PRD currently specifies fail-open (availability over strict enforcement) — confirm this is acceptable for the most security-sensitive policy domains, or whether those specific domains need fail-closed behavior.
2. Who owns ongoing curation of the ADR/policy corpus once Watson Discovery automates ingestion — is there a defined review/approval workflow for *what counts* as an enforceable policy vs. a non-binding suggestion?
3. What is the override-approval chain — can any developer self-override with justification, or does override require a second approver for high-confidence findings?
4. Multi-tenant policy scoping (FR11) — is this needed for v1, or can all teams share one corpus initially?

## 11. Out of Scope for v1

- Auto-remediation auto-apply (remains human-reviewed indefinitely per FR12, not just "for now")
- Fine-tuned/custom model training
- Legacy modernization (COBOL/RPG) policy domains — noted as a strong Phase 4+ extension given Bob's mainframe support, not committed for v1
