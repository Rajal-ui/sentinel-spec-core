'use client'
import { create } from 'zustand'
import type { Finding, Override } from '@/lib/types'
import { MOCK_FINDINGS, MOCK_OVERRIDES } from '@/lib/mock-data'

interface FindingsStore {
  findings: Finding[]
  pendingOverrides: Override[]
  overrideHistory: Override[]
  addFinding: (finding: Finding) => void
  submitOverride: (findingId: string, justification: string) => Promise<void>
  approveOverride: (overrideId: string) => Promise<void>
  rejectOverride: (overrideId: string, reason: string) => Promise<void>
}

export const useFindingsStore = create<FindingsStore>()((set, get) => ({
  findings: MOCK_FINDINGS,
  pendingOverrides: MOCK_OVERRIDES.filter((o) => o.status === 'pending'),
  overrideHistory: MOCK_OVERRIDES.filter((o) => o.status !== 'pending'),

  addFinding: (finding) =>
    set((s) => ({ findings: [finding, ...s.findings] })),

  submitOverride: async (findingId, justification) => {
    await new Promise((r) => setTimeout(r, 500))
    const override: Override = {
      id: `ov-${Date.now()}`,
      finding_id: findingId,
      finding_title: get().findings.find((f) => f.id === findingId)?.title ?? '',
      actor: 'current-user@example.com',
      justification,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      resolved_at: null,
      resolver: null,
      rejection_reason: null,
    }
    set((s) => ({ pendingOverrides: [override, ...s.pendingOverrides] }))
  },

  approveOverride: async (overrideId) => {
    await new Promise((r) => setTimeout(r, 400))
    set((s) => {
      const ov = s.pendingOverrides.find((o) => o.id === overrideId)
      if (!ov) return s
      const resolved = { ...ov, status: 'approved' as const, resolved_at: new Date().toISOString() }
      return {
        pendingOverrides: s.pendingOverrides.filter((o) => o.id !== overrideId),
        overrideHistory: [resolved, ...s.overrideHistory],
      }
    })
  },

  rejectOverride: async (overrideId, reason) => {
    await new Promise((r) => setTimeout(r, 400))
    set((s) => {
      const ov = s.pendingOverrides.find((o) => o.id === overrideId)
      if (!ov) return s
      const resolved = {
        ...ov,
        status: 'rejected' as const,
        resolved_at: new Date().toISOString(),
        rejection_reason: reason,
      }
      return {
        pendingOverrides: s.pendingOverrides.filter((o) => o.id !== overrideId),
        overrideHistory: [resolved, ...s.overrideHistory],
      }
    })
  },
}))
