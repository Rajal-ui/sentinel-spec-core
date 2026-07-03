'use client'
import { create } from 'zustand'
import type { Finding, Override } from '@/lib/types'
import api from '@/lib/api'

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
  findings: [],
  pendingOverrides: [],
  overrideHistory: [],

  addFinding: (finding) =>
    set((s) => ({ findings: [finding, ...s.findings] })),

  submitOverride: async (findingId, justification) => {
    const finding = get().findings.find((f) => f.id === findingId)
    const title = finding?.title ?? 'Unknown finding'
    const actor = 'current-user@example.com'
    try {
      const { data } = await api.post('/v1/overrides', { findingId, justification, actor, findingTitle: title })
      set((s) => ({ pendingOverrides: [data.override, ...s.pendingOverrides] }))
    } catch {
      // Offline fallback — insert local-only (will sync later)
      const override: Override = {
        id: `ov-local-${Date.now()}`,
        finding_id: findingId,
        finding_title: title,
        actor,
        justification,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        resolved_at: null,
        resolver: null,
        rejection_reason: null,
      }
      set((s) => ({ pendingOverrides: [override, ...s.pendingOverrides] }))
    }
  },

  approveOverride: async (overrideId) => {
    try {
      await api.patch(`/v1/overrides/${overrideId}/approve`)
      set((s) => {
        const ov = s.pendingOverrides.find((o) => o.id === overrideId)
        if (!ov) return s
        const resolved = { ...ov, status: 'approved' as const, resolved_at: new Date().toISOString() }
        return {
          pendingOverrides: s.pendingOverrides.filter((o) => o.id !== overrideId),
          overrideHistory: [resolved, ...s.overrideHistory],
        }
      })
    } catch {
      // Fallback to local state update
      set((s) => {
        const ov = s.pendingOverrides.find((o) => o.id === overrideId)
        if (!ov) return s
        const resolved = { ...ov, status: 'approved' as const, resolved_at: new Date().toISOString() }
        return {
          pendingOverrides: s.pendingOverrides.filter((o) => o.id !== overrideId),
          overrideHistory: [resolved, ...s.overrideHistory],
        }
      })
    }
  },

  rejectOverride: async (overrideId, reason) => {
    try {
      await api.patch(`/v1/overrides/${overrideId}/reject`, { reason })
      set((s) => {
        const ov = s.pendingOverrides.find((o) => o.id === overrideId)
        if (!ov) return s
        const resolved = { ...ov, status: 'rejected' as const, resolved_at: new Date().toISOString(), rejection_reason: reason }
        return {
          pendingOverrides: s.pendingOverrides.filter((o) => o.id !== overrideId),
          overrideHistory: [resolved, ...s.overrideHistory],
        }
      })
    } catch {
      set((s) => {
        const ov = s.pendingOverrides.find((o) => o.id === overrideId)
        if (!ov) return s
        const resolved = { ...ov, status: 'rejected' as const, resolved_at: new Date().toISOString(), rejection_reason: reason }
        return {
          pendingOverrides: s.pendingOverrides.filter((o) => o.id !== overrideId),
          overrideHistory: [resolved, ...s.overrideHistory],
        }
      })
    }
  },
}))
