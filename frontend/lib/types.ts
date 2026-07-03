// ── Sentinel Spec TypeScript Types — mirror TRD data models exactly ──

export type FindingTier = 'blocking' | 'warning' | 'logged_only' | 'rejected'
export type InputMode = 'text' | 'code' | 'upload' | 'voice'
export type PolicyDomain = 'security' | 'data_residency' | 'api_contract' | 'architecture'
export type TriggerType = 'ide_time' | 'ci_time'

export interface GovernanceRecord {
  record_id: string
  timestamp: string
  trigger: TriggerType
  actor: string
  repo: string
  diff_id: string
  classification: {
    violates_policy: boolean
    confidence: number
    cited_chunk_ids: string[]
  }
  critic_verdict: {
    entailed: boolean
    reasoning: string
  }
  finding_tier: FindingTier
  override: {
    occurred: boolean
    actor: string | null
    justification: string | null
  }
}

export interface PolicyChunk {
  chunk_id: string
  source_document: string
  text: string
  policy_domain: PolicyDomain
  team_scope: string | null
  last_indexed: string
}

export interface Finding {
  id: string
  tier: FindingTier
  confidence: number
  title: string
  description: string
  cited_adr: string
  cited_text: string
  source_document: string
  diff_old: string
  diff_new: string
  trace_id: string
  timestamp: string
  record_id: string
}

export interface Override {
  id: string
  finding_id: string
  finding_title: string
  actor: string
  justification: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  resolved_at: string | null
  resolver: string | null
  rejection_reason: string | null
}

export interface User {
  id: string
  name: string
  email: string
  role: 'developer' | 'compliance_officer' | 'engineering_manager' | 'admin'
  avatar_url: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials extends LoginCredentials {
  name: string
  username: string
}

export interface ProfileUpdate {
  name?: string
  username?: string
  avatar_url?: string | null
}

export interface AuditSession {
  id: string
  name: string
  created_at: string
  status: 'PASSED' | 'VIOLATIONS' | 'PENDING'
  finding_count: number
}

export interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  findings?: Finding[]
  model_badge?: string
  tokens?: number
  duration_ms?: number
  is_streaming?: boolean
}

export interface ThinkingStep {
  step: number
  label: string
  duration_ms: number | null
  detail: string
  status: 'pending' | 'active' | 'done'
}
