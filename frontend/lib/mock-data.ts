import type { Finding, Override, GovernanceRecord } from '@/lib/types'

export const MOCK_FINDINGS: Finding[] = [
  {
    id: 'f-001',
    tier: 'blocking',
    confidence: 0.94,
    title: 'Direct call to legacy_billing.charge() violates ADR-0042',
    description:
      'The function charge_customer() calls legacy_billing.charge() directly. ADR-0042 mandates that all billing operations route through the BillingPort abstraction layer to ensure auditability and multi-tenancy isolation.',
    cited_adr: 'ADR-0042',
    cited_text:
      'All billing operations MUST route through BillingPort. Direct calls to legacy_billing are prohibited after 2024-01-01. Violations are blocking in CI.',
    source_document: 'docs/adr/ADR-0042-billing-abstraction.md',
    diff_old: 'legacy_billing.charge(user_id, amount, currency)',
    diff_new: 'billing_port.charge(ChargeRequest(user_id=user_id, amount=amount, currency=currency))',
    trace_id: 'a3f9c-7d2b1-4e8a0-9c3f6',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    record_id: 'rec-001',
  },
  {
    id: 'f-002',
    tier: 'warning',
    confidence: 0.72,
    title: 'PII field "email" written to unencrypted log stream',
    description:
      'The field user.email is passed to logger.info() without masking. ADR-0019 requires all PII fields to be masked before logging.',
    cited_adr: 'ADR-0019',
    cited_text:
      'PII fields (email, phone, ssn, dob) MUST be masked before writing to any log stream. Use pii_mask() from the security utilities module.',
    source_document: 'docs/adr/ADR-0019-pii-handling.md',
    diff_old: 'logger.info(f"Processing user {user.email}")',
    diff_new: 'logger.info(f"Processing user {pii_mask(user.email)}")',
    trace_id: 'b7e2a-1c4d9-3f6b0-8a2e5',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    record_id: 'rec-002',
  },
  {
    id: 'f-003',
    tier: 'logged_only',
    confidence: 0.41,
    title: 'Import of deprecated internal SDK module',
    description:
      'The module internal.legacy_sdk is imported. This module is flagged as deprecated in the architecture registry but no hard prohibition is in force.',
    cited_adr: 'ADR-0031',
    cited_text:
      'internal.legacy_sdk is deprecated as of Q3 2023. Prefer internal.sdk_v2. No blocking enforcement until 2025-06-01.',
    source_document: 'docs/adr/ADR-0031-sdk-migration.md',
    diff_old: 'from internal.legacy_sdk import DataClient',
    diff_new: 'from internal.sdk_v2 import DataClient',
    trace_id: 'c9f1d-4b7e0-2a8c5-6d3b9',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    record_id: 'rec-003',
  },
]

export const MOCK_OVERRIDES: Override[] = [
  {
    id: 'ov-001',
    finding_id: 'f-001',
    finding_title: 'Direct call to legacy_billing.charge() violates ADR-0042',
    actor: 'jordan.smith@company.com',
    justification:
      'Emergency hotfix required for P0 billing outage. BillingPort adapter is not yet deployed to prod. Reverting to direct call until adapter is available. Tracked in JIRA-9842.',
    status: 'pending',
    submitted_at: new Date(Date.now() - 180000).toISOString(),
    resolved_at: null,
    resolver: null,
    rejection_reason: null,
  },
  {
    id: 'ov-002',
    finding_id: 'f-002',
    finding_title: 'PII field "email" written to unencrypted log stream',
    actor: 'riley.nguyen@company.com',
    justification:
      'Debug logging for short-lived investigation (24h window). PII masking function unavailable in this service version. Removing after root cause identified.',
    status: 'approved',
    submitted_at: new Date(Date.now() - 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 82800000).toISOString(),
    resolver: 'compliance@company.com',
    rejection_reason: null,
  },
]

export const MOCK_GOVERNANCE_RECORDS: GovernanceRecord[] = [
  {
    record_id: 'rec-001',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    trigger: 'ide_time',
    actor: 'alex.chen@company.com',
    repo: 'payments-service',
    diff_id: 'diff-a3f9',
    classification: { violates_policy: true, confidence: 0.94, cited_chunk_ids: ['chunk-042-1'] },
    critic_verdict: { entailed: true, reasoning: 'Direct legacy call confirmed by ADR text.' },
    finding_tier: 'blocking',
    status: 'OPEN',
    resolved_at: null,
    override: { occurred: false, actor: null, justification: null },
  },
  {
    record_id: 'rec-002',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    trigger: 'ci_time',
    actor: 'sam.patel@company.com',
    repo: 'user-service',
    diff_id: 'diff-b7e2',
    classification: { violates_policy: true, confidence: 0.72, cited_chunk_ids: ['chunk-019-3'] },
    critic_verdict: { entailed: true, reasoning: 'PII field in log confirmed.' },
    finding_tier: 'warning',
    status: 'OPEN',
    resolved_at: null,
    override: { occurred: true, actor: 'compliance@company.com', justification: 'Approved for debug window.' },
  },
  {
    record_id: 'rec-003',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    trigger: 'ide_time',
    actor: 'morgan.lee@company.com',
    repo: 'auth-service',
    diff_id: 'diff-c9f1',
    classification: { violates_policy: false, confidence: 0.22, cited_chunk_ids: [] },
    critic_verdict: { entailed: false, reasoning: 'Policy text does not prohibit this pattern.' },
    finding_tier: 'rejected',
    status: 'OPEN',
    resolved_at: null,
    override: { occurred: false, actor: null, justification: null },
  },
]

export const MOCK_KPI = {
  total_analyses_month: 1247,
  violations_blocked_pct: 63.4,
  override_rate_pct: 4.2,
  avg_confidence: 0.81,
}

export const MOCK_TREND_DATA = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  blocking: Math.floor(Math.random() * 12 + 2),
  warning: Math.floor(Math.random() * 20 + 5),
}))

export const MOCK_DOMAIN_DATA = [
  { domain: 'security', count: 342 },
  { domain: 'api_contract', count: 218 },
  { domain: 'data_residency', count: 176 },
  { domain: 'architecture', count: 511 },
]

export const MOCK_CAPTURE_DATA = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  ide_time: Math.floor(Math.random() * 30 + 50),
  ci_time: Math.floor(Math.random() * 20 + 20),
  missed: Math.floor(Math.random() * 10 + 5),
}))

export const MOCK_OVERRIDE_TREND = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  rate: +(Math.random() * 4 + 2).toFixed(1),
}))

export const MOCK_LEADERBOARD = [
  { repo: 'payments-service', team: 'Backend', violations: 89, override_rate: 6.2, capture_rate: 71.2, top_domain: 'architecture' },
  { repo: 'user-service', team: 'Identity', violations: 64, override_rate: 3.1, capture_rate: 68.9, top_domain: 'data_residency' },
  { repo: 'auth-service', team: 'Security', violations: 47, override_rate: 1.8, capture_rate: 81.4, top_domain: 'security' },
  { repo: 'api-gateway', team: 'Platform', violations: 38, override_rate: 4.5, capture_rate: 74.0, top_domain: 'api_contract' },
  { repo: 'data-pipeline', team: 'Data Eng', violations: 29, override_rate: 2.0, capture_rate: 78.6, top_domain: 'data_residency' },
]
