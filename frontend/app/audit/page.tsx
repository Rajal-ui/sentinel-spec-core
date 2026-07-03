'use client'
import AppShell from '@/components/layout/AppShell'
import { StatusLabel } from '@/components/shared/StatusBadge'
import { useAuthStore } from '@/lib/store/auth'
import { useFindingsStore } from '@/lib/store/findings'
import { MOCK_GOVERNANCE_RECORDS, MOCK_KPI, MOCK_OVERRIDES } from '@/lib/mock-data'
import type { GovernanceRecord } from '@/lib/types'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Filter, Download, ChevronDown, ChevronRight, Check, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PolicyDomainFilter = 'security' | 'data_residency' | 'api_contract' | 'architecture'
type TierFilter = 'BLOCKING' | 'WARNING' | 'LOGGED_ONLY' | 'REJECTED'
type OverrideFilter = 'all' | 'overridden' | 'not_overridden'
type ActiveTab = 'all' | 'pending' | 'history'

interface FilterState {
  dateFrom: string
  dateTo: string
  domains: PolicyDomainFilter[]
  tiers: TierFilter[]
  overrideStatus: OverrideFilter
  confidenceMin: number
  confidenceMax: number
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      className="glass"
      style={{
        borderRadius: 8,
        padding: 20,
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span
        className="font-mono-product"
        style={{ fontSize: 26, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </motion.div>
  )
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

const DOMAIN_OPTIONS: PolicyDomainFilter[] = ['security', 'data_residency', 'api_contract', 'architecture']
const TIER_OPTIONS: TierFilter[] = ['BLOCKING', 'WARNING', 'LOGGED_ONLY', 'REJECTED']
const DOMAIN_LABELS: Record<PolicyDomainFilter, string> = {
  security: 'security',
  data_residency: 'data_residency',
  api_contract: 'api_contract',
  architecture: 'architecture',
}

interface FilterPanelProps {
  filters: FilterState
  onChange: (f: FilterState) => void
  onRun: () => void
  onExport: () => void
}

function FilterPanel({ filters, onChange, onRun, onExport }: FilterPanelProps) {
  function toggleDomain(d: PolicyDomainFilter) {
    const next = filters.domains.includes(d)
      ? filters.domains.filter((x) => x !== d)
      : [...filters.domains, d]
    onChange({ ...filters, domains: next })
  }

  function toggleTier(t: TierFilter) {
    const next = filters.tiers.includes(t)
      ? filters.tiers.filter((x) => x !== t)
      : [...filters.tiers, t]
    onChange({ ...filters, tiers: next })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface-muted)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text)',
    padding: '6px 8px',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 12,
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 11,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    display: 'block',
    marginBottom: 6,
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: 20,
  }

  return (
    <div
      style={{
        width: '30%',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: 'fit-content',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
      }}
    >
      <div
        className="glass"
        style={{ borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 20 }}>
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <span
            className="font-mono-product"
            style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            Filter Records
          </span>
        </div>

        {/* Date range */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Date Range</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <span style={{ ...labelStyle, fontSize: 10, marginBottom: 3 }}>From</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <span style={{ ...labelStyle, fontSize: 10, marginBottom: 3 }}>To</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Policy domain chips */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Policy Domain</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DOMAIN_OPTIONS.map((d) => {
              const active = filters.domains.includes(d)
              return (
                <button
                  key={d}
                  onClick={() => toggleDomain(d)}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 10,
                    letterSpacing: '0.03em',
                    padding: '4px 9px',
                    borderRadius: 4,
                    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'rgba(255,0,122,0.18)' : 'var(--surface-muted)',
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {DOMAIN_LABELS[d]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Finding tier checkboxes */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Finding Tier</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {TIER_OPTIONS.map((t) => {
              const checked = filters.tiers.includes(t)
              return (
                <label
                  key={t}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    userSelect: 'none',
                  }}
                >
                  <div
                    onClick={() => toggleTier(t)}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: checked ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: checked ? 'var(--primary)' : 'var(--surface-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s',
                    }}
                  >
                    {checked && <Check size={9} style={{ color: '#fff' }} />}
                  </div>
                  <span onClick={() => toggleTier(t)}>{t}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Override status radios */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Override Status</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(['all', 'overridden', 'not_overridden'] as OverrideFilter[]).map((v) => {
              const labels: Record<OverrideFilter, string> = {
                all: 'All',
                overridden: 'Overridden',
                not_overridden: 'Not overridden',
              }
              const checked = filters.overrideStatus === v
              return (
                <label
                  key={v}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    userSelect: 'none',
                  }}
                  onClick={() => onChange({ ...filters, overrideStatus: v })}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: checked ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: 'var(--surface-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {checked && (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: 'var(--primary)',
                        }}
                      />
                    )}
                  </div>
                  {labels[v]}
                </label>
              )
            })}
          </div>
        </div>

        {/* Confidence range dual sliders */}
        <div style={sectionStyle}>
          <span style={labelStyle}>
            Confidence Range — {filters.confidenceMin}%–{filters.confidenceMax}%
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--text-muted)', width: 24 }}>
                Min
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={filters.confidenceMin}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onChange({ ...filters, confidenceMin: Math.min(v, filters.confidenceMax) })
                }}
                style={{ flex: 1, accentColor: 'var(--primary)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--text-muted)', width: 24 }}>
                Max
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={filters.confidenceMax}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onChange({ ...filters, confidenceMax: Math.max(v, filters.confidenceMin) })
                }}
                style={{ flex: 1, accentColor: 'var(--primary)' }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onRun}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '9px 14px',
              cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 13,
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--primary)')}
          >
            <span>Run Query</span>
            <span style={{ opacity: 0.7, fontSize: 11 }}>⌘↵</span>
          </button>
          <button
            onClick={onExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 14px',
              cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 12,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--text-muted)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
            }}
          >
            <Download size={12} />
            Export to PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Governance Record Row ─────────────────────────────────────────────────────

function RecordRow({ record }: { record: GovernanceRecord }) {
  const [expanded, setExpanded] = useState(false)
  // AMBER RULE: amber border only for override/violation records
  const isOverride = record.override.occurred
  const confidencePct = Math.round(record.classification.confidence * 100)

  const tierBadgeStyle: React.CSSProperties = {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '2px 7px',
    borderRadius: 4,
    border: '1px solid',
    display: 'inline-flex',
    alignItems: 'center',
  }

  const tierColors: Record<string, React.CSSProperties> = {
    blocking: { background: 'rgba(220,38,38,0.12)', color: '#E85D4A', borderColor: 'rgba(220,38,38,0.28)' },
    // AMBER RULE: amber for warning tier badge only
    warning: { background: 'rgba(232,165,75,0.12)', color: 'var(--amber)', borderColor: 'rgba(232,165,75,0.28)' },
    logged_only: { background: 'rgba(74,85,104,0.12)', color: 'var(--text-muted)', borderColor: 'rgba(74,85,104,0.28)' },
    rejected: { background: 'rgba(46,204,113,0.12)', color: 'var(--success)', borderColor: 'rgba(46,204,113,0.28)' },
  }

  const statusMap: Record<string, 'BLOCKING' | 'WARNING' | 'PASSED' | 'OVERRIDDEN'> = {
    blocking: 'BLOCKING',
    warning: 'WARNING',
    logged_only: 'PASSED',
    rejected: 'PASSED',
  }
  const displayStatus = isOverride ? 'OVERRIDDEN' : statusMap[record.finding_tier]

  return (
    <motion.div
      layout
      style={{
        // AMBER RULE: amber border only when override occurred (violation signal)
        border: isOverride
          ? '1px solid rgba(232,165,75,0.35)'
          : '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--surface)',
        marginBottom: 8,
        boxShadow: isOverride ? '0 0 12px rgba(232,165,75,0.06)' : 'none',
      }}
    >
      {/* Compact row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((x) => !x)}
      >
        {/* Expand chevron */}
        <div style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.15s' }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </div>

        {/* Record ID + timestamp */}
        <div style={{ minWidth: 0, flex: '0 0 auto', maxWidth: 160 }}>
          <div
            className="font-mono-product"
            style={{
              fontSize: 11,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {record.record_id}
          </div>
          <div
            className="font-mono-product"
            style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
          >
            {new Date(record.timestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        {/* Status + tier badges */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <StatusLabel status={displayStatus} />
          <span style={{ ...tierBadgeStyle, ...tierColors[record.finding_tier] }}>
            {record.finding_tier.replace('_', ' ')}
          </span>
        </div>

        {/* Confidence */}
        <div
          className="font-mono-product"
          style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}
        >
          {confidencePct}%
        </div>

        {/* Description (one-liner) */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            color: 'var(--text-secondary)',
            fontFamily: 'Inter, sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {record.critic_verdict.reasoning}
        </div>

        {/* Actor + repo + trigger */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div
            className="font-mono-product"
            style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
          >
            {record.actor.split('@')[0]}
          </div>
          <div
            className="font-mono-product"
            style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
          >
            {record.repo} · {record.trigger}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '14px 16px 16px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Citation block */}
              <div>
                <div
                  className="font-mono-product"
                  style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Cited Chunks
                </div>
                <div
                  style={{
                    background: '#0A0C0F',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '8px 12px',
                  }}
                >
                  {record.classification.cited_chunk_ids.length > 0 ? (
                    record.classification.cited_chunk_ids.map((id) => (
                      <div
                        key={id}
                        className="font-mono-product"
                        style={{ fontSize: 12, color: 'var(--text-code)' }}
                      >
                        {id}
                      </div>
                    ))
                  ) : (
                    <span className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      — no citations
                    </span>
                  )}
                </div>
              </div>

              {/* Critic verdict */}
              <div>
                <div
                  className="font-mono-product"
                  style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Critic Verdict
                </div>
                <div
                  style={{
                    background: '#0A0C0F',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <span
                    className="font-mono-product"
                    style={{
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 3,
                      border: '1px solid',
                      flexShrink: 0,
                      ...(record.critic_verdict.entailed
                        ? { background: 'rgba(220,38,38,0.12)', color: '#E85D4A', borderColor: 'rgba(220,38,38,0.3)' }
                        : { background: 'rgba(46,204,113,0.12)', color: 'var(--success)', borderColor: 'rgba(46,204,113,0.3)' }),
                    }}
                  >
                    {record.critic_verdict.entailed ? 'ENTAILED' : 'NOT ENTAILED'}
                  </span>
                  <span
                    className="font-mono-product"
                    style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}
                  >
                    {record.critic_verdict.reasoning}
                  </span>
                </div>
              </div>

              {/* Override detail — AMBER RULE: amber text only here for override signal */}
              {isOverride && (
                <div>
                  <div
                    className="font-mono-product"
                    style={{
                      fontSize: 10,
                      // AMBER RULE: amber label only for override detail
                      color: 'var(--amber)',
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Override Applied
                  </div>
                  <div
                    style={{
                      background: 'rgba(232,165,75,0.06)',
                      // AMBER RULE: amber border only for override block
                      border: '1px solid rgba(232,165,75,0.22)',
                      borderRadius: 4,
                      padding: '8px 12px',
                    }}
                  >
                    <div
                      className="font-mono-product"
                      style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}
                    >
                      Actor: {record.override.actor}
                    </div>
                    <div
                      className="font-mono-product"
                      style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}
                    >
                      {record.override.justification}
                    </div>
                  </div>
                </div>
              )}

              {/* Meta */}
              <div
                className="font-mono-product"
                style={{ fontSize: 10, color: 'var(--text-muted)' }}
              >
                diff_id: {record.diff_id} · violates_policy:{' '}
                {String(record.classification.violates_policy)} · confidence:{' '}
                {confidencePct}%
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Pending Override Card ─────────────────────────────────────────────────────

function PendingOverrideCard({ override: ov }: { override: (typeof MOCK_OVERRIDES)[0] }) {
  const { approveOverride, rejectOverride } = useFindingsStore()
  const [confirmText, setConfirmText] = useState('')
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    if (confirmText !== 'APPROVE') return
    setLoading(true)
    await approveOverride(ov.id)
    setLoading(false)
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    setLoading(true)
    await rejectOverride(ov.id, rejectReason)
    setLoading(false)
  }

  return (
    // AMBER RULE: amber border for override/violation pending card
    <div
      style={{
        border: '1px solid rgba(232,165,75,0.32)',
        borderRadius: 8,
        background: 'var(--surface)',
        overflow: 'hidden',
        marginBottom: 8,
        boxShadow: '0 0 10px rgba(232,165,75,0.05)',
      }}
    >
      <div style={{ padding: '14px 16px' }}>
        {/* Finding title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>
            {ov.finding_title}
          </div>
          <span
            className="font-mono-product"
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 4,
              background: 'rgba(255,0,122,0.15)',
              color: 'var(--primary)',
              border: '1px solid rgba(255,0,122,0.3)',
              flexShrink: 0,
            }}
          >
            PENDING
          </span>
        </div>

        {/* Developer + submitted */}
        <div
          className="font-mono-product"
          style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}
        >
          {ov.actor} · submitted{' '}
          {new Date(ov.submitted_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>

        {/* Justification */}
        <div
          style={{
            background: '#0A0C0F',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '8px 12px',
            marginBottom: 14,
          }}
        >
          <div
            className="font-mono-product"
            style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Justification
          </div>
          <p
            className="font-mono-product"
            style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}
          >
            {ov.justification}
          </p>
        </div>

        {/* Action buttons */}
        {!showApproveConfirm && !showRejectForm && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowApproveConfirm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(46,204,113,0.15)',
                color: 'var(--success)',
                border: '1px solid rgba(46,204,113,0.3)',
                borderRadius: 5,
                padding: '6px 14px',
                fontSize: 12,
                fontFamily: 'IBM Plex Mono, monospace',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(46,204,113,0.22)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(46,204,113,0.15)')}
            >
              <Check size={11} />
              Approve
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(232,93,74,0.12)',
                color: 'var(--danger)',
                border: '1px solid rgba(232,93,74,0.28)',
                borderRadius: 5,
                padding: '6px 14px',
                fontSize: 12,
                fontFamily: 'IBM Plex Mono, monospace',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(232,93,74,0.20)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(232,93,74,0.12)')}
            >
              <X size={11} />
              Reject
            </button>
          </div>
        )}

        {/* Approve confirm */}
        <AnimatePresence>
          {showApproveConfirm && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div
                className="font-mono-product"
                style={{ fontSize: 11, color: 'var(--text-secondary)' }}
              >
                Type <strong style={{ color: 'var(--success)' }}>APPROVE</strong> to confirm
              </div>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="APPROVE"
                autoFocus
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text)',
                  padding: '6px 10px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 13,
                  outline: 'none',
                  width: '100%',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleApprove}
                  disabled={confirmText !== 'APPROVE' || loading}
                  style={{
                    background: confirmText === 'APPROVE' ? 'rgba(46,204,113,0.18)' : 'rgba(74,85,104,0.15)',
                    color: confirmText === 'APPROVE' ? 'var(--success)' : 'var(--text-muted)',
                    border: `1px solid ${confirmText === 'APPROVE' ? 'rgba(46,204,113,0.3)' : 'var(--border)'}`,
                    borderRadius: 5,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontFamily: 'IBM Plex Mono, monospace',
                    cursor: confirmText === 'APPROVE' ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? 'Approving…' : 'Confirm Approve'}
                </button>
                <button
                  onClick={() => { setShowApproveConfirm(false); setConfirmText('') }}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontFamily: 'IBM Plex Mono, monospace',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reject form */}
        <AnimatePresence>
          {showRejectForm && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div
                className="font-mono-product"
                style={{ fontSize: 11, color: 'var(--text-secondary)' }}
              >
                Rejection reason (required)
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason for rejection…"
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text)',
                  padding: '7px 10px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  resize: 'vertical',
                  minHeight: 72,
                  outline: 'none',
                  width: '100%',
                  lineHeight: 1.5,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || loading}
                  style={{
                    background: rejectReason.trim() ? 'rgba(232,93,74,0.15)' : 'rgba(74,85,104,0.15)',
                    color: rejectReason.trim() ? 'var(--danger)' : 'var(--text-muted)',
                    border: `1px solid ${rejectReason.trim() ? 'rgba(232,93,74,0.3)' : 'var(--border)'}`,
                    borderRadius: 5,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontFamily: 'IBM Plex Mono, monospace',
                    cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontFamily: 'IBM Plex Mono, monospace',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Override History Card ─────────────────────────────────────────────────────

function HistoryCard({ override: ov }: { override: (typeof MOCK_OVERRIDES)[0] }) {
  const approved = ov.status === 'approved'
  return (
    // AMBER RULE: amber border only for override history (violation signal)
    <div
      style={{
        border: '1px solid rgba(232,165,75,0.22)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '12px 16px',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
          {ov.finding_title}
        </div>
        <span
          className="font-mono-product"
          style={{
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: 4,
            border: '1px solid',
            flexShrink: 0,
            ...(approved
              ? { background: 'rgba(46,204,113,0.12)', color: 'var(--success)', borderColor: 'rgba(46,204,113,0.3)' }
              : { background: 'rgba(232,93,74,0.12)', color: 'var(--danger)', borderColor: 'rgba(232,93,74,0.28)' }),
          }}
        >
          {ov.status.toUpperCase()}
        </span>
      </div>
      <div
        className="font-mono-product"
        style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}
      >
        {ov.actor} · resolved by {ov.resolver ?? '—'} ·{' '}
        {ov.resolved_at
          ? new Date(ov.resolved_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '—'}
      </div>
      {ov.rejection_reason && (
        <div
          className="font-mono-product"
          style={{ fontSize: 11, color: 'var(--danger)', lineHeight: 1.4 }}
        >
          Reason: {ov.rejection_reason}
        </div>
      )}
    </div>
  )
}

// ─── Results Feed ─────────────────────────────────────────────────────────────

interface ResultsFeedProps {
  records: GovernanceRecord[]
  activeTab: ActiveTab
  onTabChange: (t: ActiveTab) => void
}

function ResultsFeed({ records, activeTab, onTabChange }: ResultsFeedProps) {
  const { pendingOverrides, overrideHistory } = useFindingsStore()

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 12,
    padding: '6px 14px',
    border: active ? '1px solid var(--primary)' : '1px solid transparent',
    borderRadius: 5,
    background: active ? 'rgba(255,0,122,0.14)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Count line */}
      <div
        className="font-mono-product"
        style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}
      >
        {activeTab === 'all' && `${records.length.toLocaleString()} records matching query`}
        {activeTab === 'pending' && `${pendingOverrides.length} pending override${pendingOverrides.length !== 1 ? 's' : ''}`}
        {activeTab === 'history' && `${overrideHistory.length} resolved override${overrideHistory.length !== 1 ? 's' : ''}`}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button style={tabStyle(activeTab === 'all')} onClick={() => onTabChange('all')}>
          All Records
        </button>
        <button style={tabStyle(activeTab === 'pending')} onClick={() => onTabChange('pending')}>
          Pending Overrides
          {pendingOverrides.length > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: 'rgba(255,0,122,0.25)',
                color: 'var(--primary)',
                borderRadius: 8,
                padding: '1px 6px',
                fontSize: 10,
              }}
            >
              {pendingOverrides.length}
            </span>
          )}
        </button>
        <button style={tabStyle(activeTab === 'history')} onClick={() => onTabChange('history')}>
          Override History
        </button>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'all' && (
          <motion.div
            key="all"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {records.length === 0 ? (
              <div
                className="font-mono-product"
                style={{ fontSize: 13, color: 'var(--text-muted)', padding: '32px 0', textAlign: 'center' }}
              >
                No records match the current filters.
              </div>
            ) : (
              records.map((r) => <RecordRow key={r.record_id} record={r} />)
            )}
          </motion.div>
        )}

        {activeTab === 'pending' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {pendingOverrides.length === 0 ? (
              <div
                className="font-mono-product"
                style={{ fontSize: 13, color: 'var(--text-muted)', padding: '32px 0', textAlign: 'center' }}
              >
                No pending overrides.
              </div>
            ) : (
              pendingOverrides.map((ov) => <PendingOverrideCard key={ov.id} override={ov} />)
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {overrideHistory.length === 0 ? (
              <div
                className="font-mono-product"
                style={{ fontSize: 13, color: 'var(--text-muted)', padding: '32px 0', textAlign: 'center' }}
              >
                No override history.
              </div>
            ) : (
              overrideHistory.map((ov) => <HistoryCard key={ov.id} override={ov} />)
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Auth Gate ─────────────────────────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, openLoginModal } = useAuthStore()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setChecked(true)
    if (!isAuthenticated) {
      openLoginModal('/audit')
    }
  }, [isAuthenticated, openLoginModal])

  if (!checked) return null

  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 16,
          padding: 24,
        }}
      >
        <Shield size={40} style={{ color: 'var(--text-muted)' }} />
        <div
          className="font-mono-product"
          style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}
        >
          Authentication required to access Audit Intelligence Console.
        </div>
        <button
          onClick={() => openLoginModal('/audit')}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 20px',
            fontSize: 13,
            fontFamily: 'IBM Plex Mono, monospace',
            cursor: 'pointer',
          }}
        >
          Sign In
        </button>
      </div>
    )
  }

  return <>{children}</>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: '',
    dateTo: '',
    domains: [],
    tiers: [],
    overrideStatus: 'all',
    confidenceMin: 0,
    confidenceMax: 100,
  })
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const [filteredRecords, setFilteredRecords] = useState<GovernanceRecord[]>(MOCK_GOVERNANCE_RECORDS)

  function applyFilters(f: FilterState) {
    let result = [...MOCK_GOVERNANCE_RECORDS]

    if (f.dateFrom) {
      const from = new Date(f.dateFrom).getTime()
      result = result.filter((r) => new Date(r.timestamp).getTime() >= from)
    }
    if (f.dateTo) {
      const to = new Date(f.dateTo).getTime() + 86399999
      result = result.filter((r) => new Date(r.timestamp).getTime() <= to)
    }

    if (f.tiers.length > 0) {
      const tierMap: Record<TierFilter, string> = {
        BLOCKING: 'blocking',
        WARNING: 'warning',
        LOGGED_ONLY: 'logged_only',
        REJECTED: 'rejected',
      }
      result = result.filter((r) => f.tiers.map((t) => tierMap[t]).includes(r.finding_tier))
    }

    if (f.overrideStatus === 'overridden') {
      result = result.filter((r) => r.override.occurred)
    } else if (f.overrideStatus === 'not_overridden') {
      result = result.filter((r) => !r.override.occurred)
    }

    const cMin = f.confidenceMin / 100
    const cMax = f.confidenceMax / 100
    result = result.filter(
      (r) => r.classification.confidence >= cMin && r.classification.confidence <= cMax
    )

    setFilteredRecords(result)
  }

  function handleRunQuery() {
    applyFilters(filters)
  }

  function handleExport() {
    // PDF export stub — wire to real implementation when available
    console.info('Export to PDF requested', { filters, count: filteredRecords.length })
  }

  return (
    <AppShell title="Audit Intelligence Console" breadcrumb="Audit">
      <AuthGate>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KPI Strip */}
          <motion.div
            style={{ display: 'flex', gap: 12 }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, staggerChildren: 0.06 }}
          >
            <KpiCard label="Total analyses this month" value={MOCK_KPI.total_analyses_month.toLocaleString()} />
            <KpiCard label="Violations blocked pre-PR" value={`${MOCK_KPI.violations_blocked_pct}%`} />
            <KpiCard label="Override rate" value={`${MOCK_KPI.override_rate_pct}%`} />
            <KpiCard label="Avg confidence" value={`${Math.round(MOCK_KPI.avg_confidence * 100)}%`} />
          </motion.div>

          {/* Main panel: filter + results */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onRun={handleRunQuery}
              onExport={handleExport}
            />
            <ResultsFeed
              records={filteredRecords}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>
        </div>
      </AuthGate>
    </AppShell>
  )
}
