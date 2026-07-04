'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuditSession, Finding, Message, InputMode } from '@/lib/types'
import api from '@/lib/api'

// ── Mock analysis engine helpers ──────────────────────────────────────────────

interface AnalysisMatch {
  finding: Finding
  domain: string
}

let findingIdCounter = 100

function makeFinding(overrides: Partial<Finding> & { title: string; description: string; tier: Finding['tier']; confidence: number }): Finding {
  findingIdCounter++
  return {
    id: `f-dyn-${findingIdCounter}`,
    tier: overrides.tier,
    confidence: overrides.confidence,
    title: overrides.title,
    description: overrides.description,
    cited_adr: overrides.cited_adr ?? 'ADR-0017',
    cited_text: overrides.cited_text ?? '',
    source_document: overrides.source_document ?? 'docs/adr/ADR-0017-secrets-management.md',
    diff_old: overrides.diff_old ?? '',
    diff_new: overrides.diff_new ?? '',
    trace_id: `trace-${Date.now()}-${findingIdCounter}`,
    timestamp: new Date().toISOString(),
    record_id: `rec-dyn-${findingIdCounter}`,
  }
}

const SECRET_FINDING_TEMPLATE = {
  tier: 'blocking' as const,
  confidence: 0.94,
  title: 'Hard-coded cloud credential in source code (SEC-001)',
  description: 'A hard-coded cloud credential (access key / secret key) was detected in the source code. This violates ADR-0017 which mandates all credentials be resolved at runtime from a vault or environment injection.',
  cited_adr: 'ADR-0017',
  cited_text: 'All cloud credentials MUST be injected at runtime via environment variables or IBM Secrets Manager. Hard-coded credentials are prohibited and will be flagged as BLOCKING in CI.',
  source_document: 'docs/adr/ADR-0017-secrets-management.md',
  diff_old: 'ibm_secret_access_key = "AKIAIOSFODNN7EXAMPLE"',
  diff_new: 'ibm_secret_access_key = os.getenv("IBM_SECRET_ACCESS_KEY")',
}

const MISLEADING_NAME_TEMPLATE = {
  tier: 'logged_only' as const,
  confidence: 0.65,
  title: 'Misleading variable naming: ibm_ prefix with AWS key pattern (SEC-013)',
  description: 'A variable with an "ibm_" prefix contains an AWS IAM key value (AKIA...). This naming mismatch can cause confusion during audits and incident response.',
  cited_adr: 'ADR-0017',
  cited_text: 'Variable names MUST accurately reflect the provider and purpose of the secret. Misleading naming patterns should be avoided.',
  source_document: 'docs/adr/ADR-0017-secrets-management.md',
  diff_old: 'ibm_secret_access_key = "AKIAIOSFODNN7EXAMPLE"',
  diff_new: 'aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")',
}

const BILLING_TEMPLATE = {
  tier: 'blocking' as const,
  confidence: 0.94,
  title: 'Direct call to legacy_billing.charge() violates ADR-0042',
  description: 'The function calls legacy_billing.charge() directly. ADR-0042 mandates all billing operations route through the BillingPort abstraction layer.',
  cited_adr: 'ADR-0042',
  cited_text: 'All billing operations MUST route through BillingPort. Direct calls to legacy_billing are prohibited.',
  source_document: 'docs/adr/ADR-0042-billing-abstraction.md',
  diff_old: 'legacy_billing.charge(user_id, amount, currency)',
  diff_new: 'billing_port.charge(ChargeRequest(user_id=user_id, amount=amount, currency=currency))',
}

const PII_TEMPLATE = {
  tier: 'warning' as const,
  confidence: 0.72,
  title: 'PII field "email" written to unencrypted log stream',
  description: 'A user email field is passed to logger.info() without masking. ADR-0019 requires all PII fields to be masked before logging.',
  cited_adr: 'ADR-0019',
  cited_text: 'PII fields (email, phone, ssn, dob) MUST be masked before writing to any log stream. Use pii_mask() from the security utilities module.',
  source_document: 'docs/adr/ADR-0019-pii-handling.md',
  diff_old: 'logger.info(f"Processing user {user.email}")',
  diff_new: 'logger.info(f"Processing user {pii_mask(user.email)}")',
}

const DEPRECATED_SDK_TEMPLATE = {
  tier: 'logged_only' as const,
  confidence: 0.41,
  title: 'Import of deprecated internal SDK module',
  description: 'The module internal.legacy_sdk is imported. This module is flagged as deprecated in the architecture registry.',
  cited_adr: 'ADR-0031',
  cited_text: 'internal.legacy_sdk is deprecated as of Q3 2023. Prefer internal.sdk_v2.',
  source_document: 'docs/adr/ADR-0031-sdk-migration.md',
  diff_old: 'from internal.legacy_sdk import DataClient',
  diff_new: 'from internal.sdk_v2 import DataClient',
}

const LINE_PATTERNS: { pattern: RegExp; finding: AnalysisMatch; lineKey: string }[] = [
  {
    pattern: /(?:ibm_secret_access_key|aws_secret_access_key|secret_access_key)\s*=\s*['"]/i,
    finding: { finding: makeFinding(SECRET_FINDING_TEMPLATE), domain: 'secrets management (ADR-0017)' },
    lineKey: 'credential',
  },
  {
    pattern: /AKIA[0-9A-Z]{16}/,
    finding: { finding: makeFinding(SECRET_FINDING_TEMPLATE), domain: 'secrets management (ADR-0017)' },
    lineKey: 'credential',
  },
  {
    pattern: /api[_\-]?key\s*=\s*['\"][A-Za-z0-9\-_]{20,}['\"]/i,
    finding: { finding: makeFinding({ ...SECRET_FINDING_TEMPLATE, title: 'Hard-coded API key in source code (SEC-002)', confidence: 0.88, tier: 'blocking' }), domain: 'secrets management (ADR-0017)' },
    lineKey: 'credential',
  },
  {
    pattern: /ibm_.*=\s*['\"]AKIA/,
    finding: { finding: makeFinding(MISLEADING_NAME_TEMPLATE), domain: 'naming convention (SEC-013)' },
    lineKey: 'misleading-name',
  },
]

function findContentLine(content: string, pattern: RegExp): number {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1
  }
  return 1
}

interface SessionStore {
  sessions: AuditSession[]
  activeSessionId: string | null
  messages: Message[]
  messagesBySessionId: Record<string, Message[]>
  isStreaming: boolean
  thinkingStepsVisible: boolean
  resolvedFindings: Record<string, Record<string, { resolved_at: string }>>
  createSession: () => void
  deleteSession: (id: string) => void
  renameSession: (id: string, name: string) => void
  setActiveSession: (id: string) => void
  sendMessage: (content: string, mode: InputMode, meta?: { originalCode?: string; fileName?: string }) => Promise<void>
  resolveFinding: (findingId: string) => Promise<void>
  setThinkingVisible: (v: boolean) => void
}

let messageCounter = 0

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      messages: [],
      messagesBySessionId: {},
      isStreaming: false,
      thinkingStepsVisible: false,
      resolvedFindings: {},

      createSession: () => {
        const { activeSessionId, messages } = get()
        const id = `session-${Date.now()}`
        const session: AuditSession = {
          id,
          name: `Analysis ${get().sessions.length + 1}`,
          created_at: new Date().toISOString(),
          status: 'PENDING',
          finding_count: 0,
        }
        // Save current messages before switching to new session
        const pendingMessages: Record<string, Message[]> = {}
        if (activeSessionId && messages.length > 0) {
          pendingMessages[activeSessionId] = messages
        }
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
          messages: [],
          messagesBySessionId: { ...s.messagesBySessionId, ...pendingMessages },
        }))
      },

      deleteSession: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.messagesBySessionId
          return {
            sessions: s.sessions.filter((x) => x.id !== id),
            activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
            messages: s.activeSessionId === id ? [] : s.messages,
            messagesBySessionId: rest,
          }
        }),

      renameSession: (id, name) =>
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === id ? { ...x, name } : x)),
        })),

      setActiveSession: (id) => {
        const { activeSessionId, messages, messagesBySessionId } = get()
        const pendingMessages = { ...messagesBySessionId }
        // Save current session's messages
        if (activeSessionId && activeSessionId !== id && messages.length > 0) {
          pendingMessages[activeSessionId] = messages
        }
        // Load target session's messages
        const targetMessages = pendingMessages[id] || []
        set({
          activeSessionId: id,
          messages: targetMessages,
          messagesBySessionId: pendingMessages,
        })
      },

      sendMessage: async (content, mode, meta) => {
        if (!content.trim()) return
        messageCounter++
        const userMsg: Message = {
          id: `msg-${messageCounter}`,
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
          originalCode: meta?.originalCode,
          fileName: meta?.fileName,
        }
        set((s) => ({ messages: [...s.messages, userMsg], isStreaming: true }))

        await new Promise((r) => setTimeout(r, 1800))

        // ── Dynamic analysis engine ──
        const contentLower = content.toLowerCase()
        const matchedFindings: Finding[] = []
        const matchedDomains: string[] = []
        const matchedKeys = new Set<string>()

        // 1. Scan content line-by-line for security/credential patterns
        for (const entry of LINE_PATTERNS) {
          if (matchedKeys.has(entry.lineKey)) continue
          if (entry.pattern.test(content)) {
            matchedFindings.push(entry.finding.finding)
            matchedDomains.push(entry.finding.domain)
            matchedKeys.add(entry.lineKey)
          }
        }

        // 2. Architecture / code pattern heuristics (MOCK_FINDINGS)
        if (/billing|charge|payment|invoice/.test(contentLower)) {
          matchedFindings.push(makeFinding(BILLING_TEMPLATE))
          matchedDomains.push('billing abstraction (ADR-0042)')
        }
        if (/pii|email|log.*mask|logger\.(info|warn|error)/.test(contentLower)) {
          matchedFindings.push(makeFinding(PII_TEMPLATE))
          matchedDomains.push('PII handling (ADR-0019)')
        }
        if (/deprecated|legacy_sdk|internal\.(legacy|old)/.test(contentLower)) {
          matchedFindings.push(makeFinding(DEPRECATED_SDK_TEMPLATE))
          matchedDomains.push('SDK migration (ADR-0031)')
        }

        // 3. File-name based heuristics (when only filenames provided)
        if (/Files:/.test(content)) {
          const fileNames = content.replace('Files: ', '').split(', ')
          for (const name of fileNames) {
            if (/secret|credential|key|access/.test(name.toLowerCase())) {
              if (!matchedKeys.has('credential')) {
                matchedFindings.push(makeFinding(SECRET_FINDING_TEMPLATE))
                matchedDomains.push('secrets management (ADR-0017)')
                matchedKeys.add('credential')
              }
            }
            if (/billing|charge|payment/.test(name.toLowerCase())) {
              matchedFindings.push(makeFinding(BILLING_TEMPLATE))
              matchedDomains.push('billing abstraction (ADR-0042)')
            }
            if (/user|auth|pii|log/.test(name.toLowerCase())) {
              matchedFindings.push(makeFinding(PII_TEMPLATE))
              matchedDomains.push('PII handling (ADR-0019)')
            }
            if (/sdk|internal|deprecated/.test(name.toLowerCase())) {
              matchedFindings.push(makeFinding(DEPRECATED_SDK_TEMPLATE))
              matchedDomains.push('SDK migration (ADR-0031)')
            }
          }
        }

        const isQuestion = /^(what|how|why|can|could|would|should|is|are|do|does|describe|explain|check|review|scan)/i.test(content.trim())
        const hasCodeContent = matchedFindings.length > 0 || /import|function|const|let|class|def|export|interface|type|impl|fn /.test(contentLower)

        const summary = matchedFindings.length > 0
          ? (matchedFindings.length === 1
              ? `Analysis complete. I found 1 policy violation in the submitted code related to ${matchedDomains[0]}.`
              : `Analysis complete. I found ${matchedFindings.length} policy violations in the submitted code related to ${matchedDomains.join(', ')}.`)
          : !hasCodeContent || isQuestion
            ? `I understand your question. To perform a compliance analysis, please provide the actual code or files you'd like me to review. I can check for ADR violations, PII handling, deprecated API usage, and architectural compliance issues.`
            : `Analysis complete. I did not find any policy violations in the submitted code. It appears to comply with all relevant ADRs.`

        messageCounter++
        const agentMsg: Message = {
          id: `msg-${messageCounter}`,
          role: 'agent',
          content: summary,
          timestamp: new Date().toISOString(),
          findings: matchedFindings,
        }
        set((s) => {
          const updatedMessages = [...s.messages, agentMsg]
          const updatedMessagesBySessionId = s.activeSessionId
            ? { ...s.messagesBySessionId, [s.activeSessionId]: updatedMessages }
            : s.messagesBySessionId
          return {
            messages: updatedMessages,
            isStreaming: false,
            messagesBySessionId: updatedMessagesBySessionId,
            sessions: s.sessions.map((x) =>
              x.id === s.activeSessionId
                ? { ...x, status: matchedFindings.some(f => f.tier === 'blocking' || f.tier === 'warning') ? 'VIOLATIONS' as const : 'PASSED' as const, finding_count: matchedFindings.length }
                : x
            ),
          }
        })

        // ── Persist findings to PostgreSQL ──
        if (matchedFindings.length > 0) {
          try {
            await api.post('/v1/findings/bulk', {
              repo: 'payments-service',
              actor: 'current-user@example.com',
              trigger: 'ide_time',
              diff_id: `diff-${Date.now()}`,
              findings: matchedFindings,
            })
          } catch {
            // Database unavailable — findings live in memory only until next analysis
          }
        }
      },

      resolveFinding: async (findingId) => {
        const state = get()
        const sessionId = state.activeSessionId
        if (!sessionId) return

        // Look up the finding in active messages to extract diff_new for the patch
        let patchDiff: string | undefined
        for (const msg of state.messages) {
          if (msg.findings) {
            const found = msg.findings.find((f) => f.id === findingId)
            if (found) {
              patchDiff = found.diff_new
              break
            }
          }
        }

        // Dispatch PATCH to backend — best-effort
        try {
          await api.patch(`/v1/findings/${findingId}/resolve`, { patchDiff })
        } catch {
          // fallback: continue with local update even if API is unavailable
        }

        // Optimistic local state update
        set((s) => {
          if (s.activeSessionId !== sessionId) return s
          return {
            resolvedFindings: {
              ...s.resolvedFindings,
              [sessionId]: {
                ...(s.resolvedFindings[sessionId] || {}),
                [findingId]: { resolved_at: new Date().toISOString() },
              },
            },
          }
        })
      },

      setThinkingVisible: (v) => set({ thinkingStepsVisible: v }),
    }),
    {
      name: 'sentinel-sessions',
      version: 2,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persisted: any, version) => {
        if (version < 2) {
          return {
            ...persisted,
            resolvedFindings: persisted?.resolvedFindings ?? {},
          }
        }
        return persisted
      },
      partialize: (state) => ({ sessions: state.sessions, messagesBySessionId: state.messagesBySessionId, resolvedFindings: state.resolvedFindings }),
    }
  )
)
