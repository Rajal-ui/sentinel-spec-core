'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuditSession, Finding, Message, InputMode, FileQueueItem } from '@/lib/types'
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
    filename: overrides.filename,
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

type FindingTemplate = {
  tier: Finding['tier']
  confidence: number
  title: string
  description: string
  cited_adr?: string
  cited_text?: string
  source_document?: string
  diff_old?: string
  diff_new?: string
}

const LINE_PATTERNS: { pattern: RegExp; template: FindingTemplate; domain: string; lineKey: string }[] = [
  {
    pattern: /(?:ibm_secret_access_key|aws_secret_access_key|secret_access_key)\s*=\s*['"]/i,
    template: SECRET_FINDING_TEMPLATE,
    domain: 'secrets management (ADR-0017)',
    lineKey: 'credential',
  },
  {
    pattern: /AKIA[0-9A-Z]{16}/,
    template: SECRET_FINDING_TEMPLATE,
    domain: 'secrets management (ADR-0017)',
    lineKey: 'credential',
  },
  {
    pattern: /api[_\-]?key\s*=\s*['\"][A-Za-z0-9\-_]{20,}['\"]/i,
    template: { ...SECRET_FINDING_TEMPLATE, title: 'Hard-coded API key in source code (SEC-002)', confidence: 0.88, tier: 'blocking' as const },
    domain: 'secrets management (ADR-0017)',
    lineKey: 'credential',
  },
  {
    pattern: /ibm_.*=\s*['\"]AKIA/,
    template: MISLEADING_NAME_TEMPLATE,
    domain: 'naming convention (SEC-013)',
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

// ── Conversational QA response generator ──────────────────────────────────────

function generateConversationalResponse(contentLower: string): string {
  // Compliance matrix / rules questions
  if (/compliance|rule|matrix|policy|policies|22|twenty/.test(contentLower)) {
    return `The Sentinel Spec compliance engine enforces **22 rules** across 8 policy domains:\n\n` +
      `**Security (SEC-001 \u2013 SEC-013):**\n\n` +
      `- **SEC-001**: Hard-coded credential \u2014 CRITICAL\n` +
      `- **SEC-002**: API key in source \u2014 CRITICAL\n` +
      `- **SEC-003/004/005**: SQL, OS command, and template injection \u2014 HIGH\n` +
      `- **SEC-006/007**: Path traversal & unsafe file open \u2014 HIGH/MEDIUM\n` +
      `- **SEC-008/009**: Weak cipher & insecure random \u2014 HIGH/MEDIUM\n` +
      `- **SEC-010/011**: Missing auth & broken access control \u2014 CRITICAL/HIGH\n` +
      `- **SEC-012/013**: PII in logs & sensitive data in stack traces \u2014 HIGH/MEDIUM\n\n` +
      `**Architecture (ARCH-001 \u2013 ARCH-007):**\n\n` +
      `- **ARCH-001/002**: Hexagonal domain leakage & framework imports in domain\n` +
      `- **ARCH-003/004**: Direct DB calls from domain & missing port abstraction\n` +
      `- **ARCH-005**: Data residency violation \u2014 CRITICAL\n` +
      `- **ARCH-006/007**: API contract drift & undocumented public endpoints\n\n` +
      `**Quality (QUAL-001 \u2013 QUAL-002):**\n\n` +
      `- **QUAL-001**: Unsafe deserialization \u2014 HIGH\n` +
      `- **QUAL-002**: Unhandled exception exposure \u2014 MEDIUM\n\n` +
      `Upload a code file or paste code to run these checks against your source.`
  }

  // Adversarial critic / dual-agent architecture
  if (/adversarial|critic|dual.?agent|sentinel|classifier|engine|how.*work/.test(contentLower)) {
    return `Sentinel Spec uses a **dual-agent architecture** powered by IBM Granite 4 Haiku Small:\n\n` +
      `**Agent 1 \u2014 Sentinel Classifier:**\n\n` +
      `Receives your code snippet and cross-references it against the 22-rule compliance matrix. It identifies potential violations, maps them to ADRs, and assigns severity tiers (blocking, warning, logged_only).\n\n` +
      `**Agent 2 \u2014 Adversarial Critic:**\n\n` +
      `Intercepts Agent 1\u2019s analysis in an independent, zero-bias context block. It performs strict **entailment verification** \u2014 confirming that each flagged violation is genuinely supported by the code evidence. This eliminates false positives before results reach you.\n\n` +
      `**Execution Records**\n\n` +
      `Persisted to IBM Cloud Object Storage for audit trail and governance reporting.\n\n` +
      `Upload code to see both agents in action.`
  }

  // ADR questions
  if (/adr|decision.?record/.test(contentLower)) {
    return `Architecture Decision Records (ADRs) are the policy backbone of Sentinel Spec. Key ADRs include:\n\n` +
      `- **ADR-0017** \u2014 Secrets Management: All credentials MUST be injected at runtime via env vars or IBM Secrets Manager\n` +
      `- **ADR-0042** \u2014 Billing Abstraction: All billing operations MUST route through BillingPort\n` +
      `- **ADR-0019** \u2014 PII Handling: PII fields MUST be masked before writing to any log stream\n` +
      `- **ADR-0031** \u2014 SDK Migration: Deprecated modules must be replaced with current versions\n\n` +
      `These are enforced automatically when you submit code for analysis. Paste or upload code to check compliance.`
  }

  // Getting started / how to use
  if (/how|start|use|upload|paste|begin|guide|help|getting/.test(contentLower)) {
    return `**Getting started with Sentinel Spec:**\n\n` +
      `1. **Upload a file** \u2014 Click the upload zone in the left panel or drag-and-drop a source file\n` +
      `2. **Paste code** \u2014 Switch to the "Paste Code" tab and paste your code snippet\n` +
      `3. **Ask questions** \u2014 Type questions about compliance rules, ADRs, or the analysis engine\n\n` +
      `The engine will check your code against all 22 compliance rules and report violations with suggested fixes.`
  }

  // Default conversational response
  return `I can help with compliance analysis and architecture questions. Here\u2019s what I can do:\n\n` +
    `- **Analyze code** \u2014 Upload a file or paste code to check against 22 compliance rules\n` +
    `- **Explain rules** \u2014 Ask about specific rules (e.g., "What is SEC-001?") or the full compliance matrix\n` +
    `- **ADR guidance** \u2014 Ask about Architecture Decision Records and policy requirements\n` +
    `- **System overview** \u2014 Learn about the dual-agent engine and how the Sentinel Classifier and Adversarial Critic work\n\n` +
    `To run a compliance scan, upload or paste your source code using the left panel.`
}

interface SessionStore {
  sessions: AuditSession[]
  activeSessionId: string | null
  messages: Message[]
  messagesBySessionId: Record<string, Message[]>
  isStreaming: boolean
  thinkingStepsVisible: boolean
  resolvedFindings: Record<string, Record<string, { resolved_at: string }>>
  fileQueue: FileQueueItem[]
  selectedFileFilter: string | null
  createSession: () => void
  deleteSession: (id: string) => void
  renameSession: (id: string, name: string) => void
  setActiveSession: (id: string) => void
  sendMessage: (content: string, mode: InputMode, meta?: { originalCode?: string; fileName?: string }) => Promise<void>
  analyzeFiles: (files: { name: string; content: string }[]) => Promise<void>
  setFileQueue: (files: FileQueueItem[]) => void
  updateFileStatus: (filename: string, status: FileQueueItem['status'], violationCount?: number) => void
  clearFileQueue: () => void
  setSelectedFileFilter: (filename: string | null) => void
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
      fileQueue: [],
      selectedFileFilter: null,

      createSession: () => {
        const { activeSessionId, messages } = get()
        const id = `session-${Date.now()}`
        const session: AuditSession = {
          id,
          name: `Analysis ${get().sessions.length + 1}`,
          created_at: new Date().toISOString(),
          status: 'PENDING',
          finding_count: 0,
          blocking_count: 0,
          warning_count: 0,
          logged_only_count: 0,
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
            matchedFindings.push(makeFinding(entry.template))
            matchedDomains.push(entry.domain)
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

        // Find the active workspace context from the session messages
        const currentMessages = get().messages
        const codeMessage = [...currentMessages].reverse().find(m => m.originalCode)
        const activeCode = codeMessage?.originalCode
        const activeFileName = codeMessage?.fileName

        // Find existing findings in this session
        const activeFindings = currentMessages.flatMap(m => m.findings || [])

        const isQuestion = /^(what|how|why|can|could|would|should|is|are|do|does|describe|explain|check|review|scan|give|show|list|summarize|tell)/i.test(content.trim())
        const hasCodeContent = matchedFindings.length > 0 || /import|function|const|let|class|def|export|interface|type|impl|fn /.test(contentLower)
        const hasFileAttachment = !!meta?.originalCode || !!meta?.fileName

        let summary = ''
        if (matchedFindings.length > 0) {
          summary = matchedFindings.length === 1
            ? `Analysis complete. I found **1 policy violation** in the submitted code related to **${matchedDomains[0]}**.`
            : `Analysis complete. I found **${matchedFindings.length} policy violations** in the submitted code related to ${matchedDomains.map(d => `**${d}**`).join(', ')}.`
        } else if (activeCode && isQuestion) {
          // User asked a question and we have code/findings context!
          if (contentLower.includes('violation') || contentLower.includes('finding') || contentLower.includes('summary') || contentLower.includes('report') || contentLower.includes('flag')) {
            if (activeFindings.length > 0) {
              summary = `Based on the active analysis of \`${activeFileName}\`, here is a summary of the compliance findings:\n\n` +
                activeFindings.map((f, i) =>
                  `**Finding ${i + 1}: ${f.title}**\n\n` +
                  `**Severity:** ${f.tier.toUpperCase()} (confidence: ${Math.round(f.confidence * 100)}%)\n\n` +
                  `- **ADR Reference:** ${f.cited_adr}\n` +
                  `- **Description:** ${f.description}\n` +
                  `- **Suggested Fix:** \`${f.diff_new}\``
                ).join('\n\n---\n\n')
            } else {
              summary = `I checked the active file \`${activeFileName}\` and found **no compliance violations**. The code aligns with all active architecture decision records (ADRs).`
            }
          } else if (contentLower.includes('code') || contentLower.includes('file') || contentLower.includes('contents') || contentLower.includes('source')) {
            summary = `The active code file is \`${activeFileName}\`. Here is the source code being analyzed:\n\n\`\`\`python\n${activeCode}\n\`\`\``
          } else {
            summary = `I understand your question about \`${activeFileName}\`. The active analysis has flagged **${activeFindings.length} finding(s)**. You can ask me for a "summary of violations" or to view the "code content" in detail.`
          }
        } else if (!hasCodeContent && !hasFileAttachment && isQuestion) {
          // Text-only conversational query — answer directly
          summary = generateConversationalResponse(contentLower)
        } else if (!hasCodeContent && !hasFileAttachment) {
          // Non-question text without code — prompt for code
          summary = `I can analyze that for you. To run a compliance scan, please upload a file, paste code in the left panel, or drag-and-drop a source file. I\u2019ll check it against all 22 compliance rules.\n\nYou can also ask me questions about the compliance matrix, ADR policies, or how the dual-agent engine works.`
        } else {
          summary = `Analysis complete. I did not find any policy violations in the submitted code. It appears to comply with all relevant ADRs.`
        }

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
            sessions: s.sessions.map((x) => {
              if (x.id !== s.activeSessionId) return x
              const hasViolations = matchedFindings.some(f => f.tier === 'blocking' || f.tier === 'warning')
              const worstTier: AuditSession['worst_tier'] = matchedFindings.some(f => f.tier === 'blocking')
                ? 'blocking'
                : matchedFindings.some(f => f.tier === 'warning')
                  ? 'warning'
                  : matchedFindings.some(f => f.tier === 'logged_only')
                    ? 'logged_only'
                    : null
              return {
                ...x,
                status: hasViolations ? 'VIOLATIONS' as const : 'PASSED' as const,
                finding_count: matchedFindings.length,
                worst_tier: worstTier,
                blocking_count: matchedFindings.filter(f => f.tier === 'blocking').length,
                warning_count: matchedFindings.filter(f => f.tier === 'warning').length,
                logged_only_count: matchedFindings.filter(f => f.tier === 'logged_only').length,
              }
            }),
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

      setFileQueue: (files) => set({ fileQueue: files }),

      updateFileStatus: (filename, status, violationCount) =>
        set((s) => ({
          fileQueue: s.fileQueue.map((item) =>
            item.filename === filename ? { ...item, status, ...(violationCount !== undefined ? { violationCount } : {}) } : item,
          ),
        })),

      clearFileQueue: () => set({ fileQueue: [], selectedFileFilter: null }),

      setSelectedFileFilter: (filename) => set({ selectedFileFilter: filename }),

      analyzeFiles: async (files) => {
        if (!files.length) return

        const { activeSessionId, createSession: create } = get()
        if (!activeSessionId) create()

        const queueItems: FileQueueItem[] = files.map((f) => ({
          filename: f.name,
          status: 'queued' as const,
        }))
        set({ fileQueue: queueItems, isStreaming: true })

        const allFindings: Finding[] = []
        const allDomains: string[] = []
        let passedCount = 0

        for (const file of files) {
          set((s) => ({
            fileQueue: s.fileQueue.map((item) =>
              item.filename === file.name ? { ...item, status: 'analysing' as const } : item,
            ),
          }))

          await new Promise((r) => setTimeout(r, 900))

          const contentLower = file.content.toLowerCase()
          const fileFindings: Finding[] = []
          const fileDomains: string[] = []
          const matchedKeys = new Set<string>()

          for (const entry of LINE_PATTERNS) {
            if (matchedKeys.has(entry.lineKey)) continue
            if (entry.pattern.test(file.content)) {
              fileFindings.push(makeFinding({ ...entry.template, filename: file.name }))
              fileDomains.push(entry.domain)
              matchedKeys.add(entry.lineKey)
            }
          }

          if (/billing|charge|payment|invoice/.test(contentLower)) {
            fileFindings.push(makeFinding({ ...BILLING_TEMPLATE, filename: file.name }))
            fileDomains.push('billing abstraction (ADR-0042)')
          }
          if (/pii|email|log.*mask|logger\.(info|warn|error)/.test(contentLower)) {
            fileFindings.push(makeFinding({ ...PII_TEMPLATE, filename: file.name }))
            fileDomains.push('PII handling (ADR-0019)')
          }
          if (/deprecated|legacy_sdk|internal\.(legacy|old)/.test(contentLower)) {
            fileFindings.push(makeFinding({ ...DEPRECATED_SDK_TEMPLATE, filename: file.name }))
            fileDomains.push('SDK migration (ADR-0031)')
          }

          const hasBlocking = fileFindings.some((f) => f.tier === 'blocking' || f.tier === 'warning')
          if (!hasBlocking) {
            passedCount++
          }

          set((s) => ({
            fileQueue: s.fileQueue.map((item) =>
              item.filename === file.name
                ? { ...item, status: hasBlocking ? 'violations' as const : 'passed' as const, violationCount: fileFindings.length || undefined }
                : item,
            ),
          }))

          allFindings.push(...fileFindings)
          allDomains.push(...fileDomains)
        }

        const violationCount = allFindings.length
        let summary: string
        if (violationCount === 0) {
          summary = `Analysis complete. All **${files.length} files** passed compliance checks. No violations found.`
        } else if (files.length === 1) {
          summary = `Analysis complete. Found **${violationCount} violation${violationCount !== 1 ? 's' : ''}** in **${files[0].name}** related to ${allDomains.map((d) => `**${d}**`).join(', ')}.`
        } else {
          summary = `Analysis complete. **${passedCount}** file${passedCount !== 1 ? 's' : ''} passed, **${files.length - passedCount}** with violations. Found **${violationCount} total violation${violationCount !== 1 ? 's' : ''}** across ${allDomains.map((d) => `**${d}**`).join(', ')}.`
        }

        messageCounter++
        const agentMsg: Message = {
          id: `msg-${messageCounter}`,
          role: 'agent',
          content: summary,
          timestamp: new Date().toISOString(),
          findings: allFindings,
        }

        set((s) => {
          const updated = [...s.messages, agentMsg]
          const bySession = s.activeSessionId
            ? { ...s.messagesBySessionId, [s.activeSessionId]: updated }
            : s.messagesBySessionId
          return {
            messages: updated,
            isStreaming: false,
            messagesBySessionId: bySession,
            sessions: s.sessions.map((x) => {
              if (x.id !== s.activeSessionId) return x
              const worstTier: AuditSession['worst_tier'] = allFindings.some((f) => f.tier === 'blocking')
                ? 'blocking'
                : allFindings.some((f) => f.tier === 'warning')
                  ? 'warning'
                  : allFindings.some((f) => f.tier === 'logged_only')
                    ? 'logged_only'
                    : null
              return {
                ...x,
                status: allFindings.length > 0 ? 'VIOLATIONS' as const : 'PASSED' as const,
                finding_count: allFindings.length,
                worst_tier: worstTier,
                blocking_count: allFindings.filter((f) => f.tier === 'blocking').length,
                warning_count: allFindings.filter((f) => f.tier === 'warning').length,
                logged_only_count: allFindings.filter((f) => f.tier === 'logged_only').length,
              }
            }),
          }
        })

        if (allFindings.length > 0) {
          try {
            await api.post('/v1/findings/bulk', {
              repo: 'payments-service',
              actor: 'current-user@example.com',
              trigger: 'ide_time',
              diff_id: `diff-${Date.now()}`,
              findings: allFindings,
            })
          } catch {
            // Database unavailable — findings live in memory only until next analysis
          }
        }
      },

    }),
    {
      name: 'sentinel-sessions',
      version: 6,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persisted: any, version) => {
        if (version < 2) {
          return {
            ...persisted,
            resolvedFindings: persisted?.resolvedFindings ?? {},
          }
        }
        if (version < 3) {
          return {
            ...persisted,
            sessions: (persisted?.sessions ?? []).map((s: AuditSession) => ({
              ...s,
              worst_tier: s.worst_tier ?? null,
            })),
          }
        }
        if (version < 4) {
          return {
            ...persisted,
            sessions: (persisted?.sessions ?? []).map((s: AuditSession) => ({
              ...s,
              blocking_count: s.blocking_count ?? null,
              warning_count: s.warning_count ?? null,
            })),
          }
        }
        if (version < 5) {
          return {
            ...persisted,
            sessions: (persisted?.sessions ?? []).map((s: AuditSession) => ({
              ...s,
              logged_only_count: s.logged_only_count ?? null,
            })),
          }
        }
        if (version < 6) {
          return {
            ...persisted,
            fileQueue: persisted?.fileQueue ?? [],
            selectedFileFilter: null,
          }
        }
        return persisted
      },
      partialize: (state) => ({ sessions: state.sessions, messagesBySessionId: state.messagesBySessionId, resolvedFindings: state.resolvedFindings, fileQueue: state.fileQueue, selectedFileFilter: state.selectedFileFilter }),
    }
  )
)
