'use client'
import AppShell from '@/components/layout/AppShell'
import { StatusLabel } from '@/components/shared/StatusBadge'
import { useAuthStore } from '@/lib/store/auth'
import { useFindingsStore } from '@/lib/store/findings'
import type { GovernanceRecord, Override } from '@/lib/types'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '@/lib/api'
import { Shield, ShieldAlert, Filter, Download, ChevronDown, ChevronRight, Check, X } from 'lucide-react'

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
      className="flex-1 min-w-0 flex flex-col gap-1.5 rounded-xl p-5
                 bg-white/55 border border-white/70 backdrop-blur-xl shadow-sm
                 dark:bg-[#111116]/65 dark:border-[#1F2029]/80"
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

// ─── Filter Drawer ────────────────────────────────────────────────────────────

const DOMAIN_OPTIONS: PolicyDomainFilter[] = ['security', 'data_residency', 'api_contract', 'architecture']
const TIER_OPTIONS: TierFilter[] = ['BLOCKING', 'WARNING', 'LOGGED_ONLY', 'REJECTED']
const DOMAIN_LABELS: Record<PolicyDomainFilter, string> = {
  security: 'security',
  data_residency: 'data_residency',
  api_contract: 'api_contract',
  architecture: 'architecture',
}

const DEFAULT_FILTERS: FilterState = {
  dateFrom: '',
  dateTo: '',
  domains: [],
  tiers: [],
  overrideStatus: 'all',
  confidenceMin: 0,
  confidenceMax: 100,
}

interface FilterDrawerProps {
  open: boolean
  onClose: () => void
  filters: FilterState
  onChange: (f: FilterState) => void
  onRun: () => void
  onExport: () => void
  onClear: () => void
}

function FilterDrawer({ open, onClose, filters, onChange, onRun, onExport, onClear }: FilterDrawerProps) {
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
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 40,
            }}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-85 overflow-y-auto custom-scrollbar"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(24px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
              borderLeft: '1px solid var(--border)',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
              padding: 24,
            }}
          >
            {/* Close + header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                <span
                  className="font-mono-product"
                  style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  Filter Records
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={onClear}
                  className="font-mono-product"
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                >
                  Clear All
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={13} />
                </button>
              </div>
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
                    className="dark:[color-scheme:dark]"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <span style={{ ...labelStyle, fontSize: 10, marginBottom: 3 }}>To</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                    className="dark:[color-scheme:dark]"
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
                      className={
                        active
                          ? 'bg-[#FF5C00]/10 text-[#FF5C00] border border-[#FF5C00]/30 font-medium'
                          : 'text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-700/60 hover:text-[#FF5C00]'
                      }
                      style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 10,
                        letterSpacing: '0.03em',
                        padding: '4px 9px',
                        borderRadius: 4,
                        background: active ? undefined : 'var(--surface-muted)',
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

            {/* Confidence range — number inputs */}
            <div style={sectionStyle}>
              <span style={labelStyle}>
                Confidence Range — {filters.confidenceMin}%–{filters.confidenceMax}%
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--text-muted)', width: 28 }}>
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
                  <input
                    type="number"
                    min={0}
                    max={filters.confidenceMax}
                    value={filters.confidenceMin}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)))
                      onChange({ ...filters, confidenceMin: Math.min(v, filters.confidenceMax) })
                    }}
                    style={{
                      width: 56,
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text)',
                      padding: '4px 6px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 11,
                      outline: 'none',
                      textAlign: 'center',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--text-muted)', width: 28 }}>
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
                  <input
                    type="number"
                    min={filters.confidenceMin}
                    max={100}
                    value={filters.confidenceMax}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)))
                      onChange({ ...filters, confidenceMax: Math.max(v, filters.confidenceMin) })
                    }}
                    style={{
                      width: 56,
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text)',
                      padding: '4px 6px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 11,
                      outline: 'none',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => { onRun(); onClose() }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                <span style={{ opacity: 0.7, fontSize: 11, marginLeft: 8 }}>⌘↵</span>
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Governance Record Row ─────────────────────────────────────────────────────

function RecordRow({ record }: { record: GovernanceRecord }) {
  const [expanded, setExpanded] = useState(false)
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
    blocking: { background: 'rgba(244,63,94,0.10)', color: '#e11d48', borderColor: 'rgba(244,63,94,0.20)' },
    warning: { background: 'rgba(232,165,75,0.12)', color: 'var(--amber)', borderColor: 'rgba(232,165,75,0.28)' },
    logged_only: { background: 'rgba(74,85,104,0.12)', color: 'var(--text-muted)', borderColor: 'rgba(74,85,104,0.28)' },
    rejected: { background: 'rgba(16,185,129,0.10)', color: '#059669', borderColor: 'rgba(16,185,129,0.20)' },
  }

  const displayStatus: 'BLOCKING' | 'WARNING' | 'PASSED' | 'OVERRIDDEN' | 'RESOLVED' =
    record.status === 'RESOLVED'
      ? 'RESOLVED'
      : isOverride
        ? 'OVERRIDDEN'
        : ({ blocking: 'BLOCKING', warning: 'WARNING', logged_only: 'PASSED', rejected: 'PASSED' } as Record<string, 'BLOCKING' | 'WARNING' | 'PASSED'>)[record.finding_tier]

  const tierLabel = record.finding_tier.replace('_', ' ')
  const showTierBadge = displayStatus === 'RESOLVED' || displayStatus === 'OVERRIDDEN' || displayStatus.toUpperCase() !== tierLabel.toUpperCase()

  return (
    <motion.div
      layout
      className="bg-white/55 border backdrop-blur-xl rounded-lg overflow-hidden
                 dark:bg-[#111116]/65 dark:border-[#1F2029]/80"
      style={{
        borderColor: isOverride ? 'rgba(232,165,75,0.35)' : undefined,
        boxShadow: isOverride ? '0 0 12px rgba(232,165,75,0.06)' : undefined,
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

        {/* Status badge + conditionally tier badge */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <StatusLabel status={displayStatus} />
          {showTierBadge && (
            <span style={{ ...tierBadgeStyle, ...tierColors[record.finding_tier] }}>
              {tierLabel}
            </span>
          )}
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
              {/* Citation sources — hidden when empty */}
              {record.classification.cited_chunk_ids.length > 0 && (
                <div className="text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-500">Policy Sources:</span>{' '}
                  {record.classification.cited_chunk_ids.join(', ')}
                </div>
              )}

              {/* Critic verdict — humanized badges */}
              <div>
                {record.critic_verdict.entailed ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono-product"
                    style={{ fontSize: 11, background: 'rgba(232,165,75,0.10)', color: '#e8a54b', borderColor: 'rgba(232,165,75,0.22)' }}
                  >
                    ✓ Critic Verified
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono-product"
                    style={{ fontSize: 11, background: 'rgba(16,185,129,0.10)', color: '#059669', borderColor: 'rgba(16,185,129,0.22)' }}
                  >
                    Dismissed as False Positive
                  </span>
                )}
              </div>

              {/* Override detail */}
              {isOverride && (
                <div>
                  <div
                    className="font-mono-product"
                    style={{ fontSize: 10, color: 'var(--amber)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  >
                    Override Applied
                  </div>
                  <div
                    style={{
                      background: 'rgba(232,165,75,0.06)',
                      border: '1px solid rgba(232,165,75,0.22)',
                      borderRadius: 4,
                      padding: '8px 12px',
                    }}
                  >
                    <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      Actor: {record.override.actor}
                    </div>
                    <div className="font-mono-product" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                      {record.override.justification}
                    </div>
                  </div>
                </div>
              )}

              {/* Meta chips — diff_id + confidence only */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span
                  className="font-mono-product"
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(100,116,139,0.08)',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(100,116,139,0.18)',
                  }}
                >
                  {record.diff_id}
                </span>
                <span
                  className="font-mono-product"
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(100,116,139,0.08)',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(100,116,139,0.18)',
                  }}
                >
                  {confidencePct}% confidence
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Pending Override Card ─────────────────────────────────────────────────────

function PendingOverrideCard({ override: ov }: { override: Override }) {
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
    <div
      className="bg-white/55 border backdrop-blur-xl rounded-lg overflow-hidden mb-2
                 dark:bg-[#111116]/65"
      style={{
        borderColor: 'rgba(232,165,75,0.32)',
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
              background: 'rgba(255,92,0,0.10)',
              color: 'var(--primary)',
              border: '1px solid rgba(255,92,0,0.30)',
              flexShrink: 0,
            }}
          >
            PENDING
          </span>
        </div>

        {/* Developer + submitted */}
        <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          {ov.actor} · submitted{' '}
          {new Date(ov.submitted_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>

        {/* Justification */}
        <div className="code-block" style={{ padding: '8px 12px', marginBottom: 14 }}>
          <div className="font-mono-product" style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Justification
          </div>
          <p className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {ov.justification}
          </p>
        </div>

        {/* Action buttons */}
        {!showApproveConfirm && !showRejectForm && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowApproveConfirm(true)}
              className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, borderRadius: 5,
                padding: '6px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.18)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
            >
              <Check size={11} />
              Approve
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              className="bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:text-rose-400"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, borderRadius: 5,
                padding: '6px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.18)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
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
              <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Type <strong style={{ color: '#059669' }}>APPROVE</strong> to confirm
              </div>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="APPROVE"
                autoFocus
                style={{
                  background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 4,
                  color: 'var(--text)', padding: '6px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, outline: 'none', width: '100%',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleApprove}
                  disabled={confirmText !== 'APPROVE' || loading}
                  className={confirmText === 'APPROVE' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400' : ''}
                  style={{
                    background: confirmText === 'APPROVE' ? undefined : 'rgba(74,85,104,0.15)',
                    color: confirmText === 'APPROVE' ? undefined : 'var(--text-muted)',
                    border: confirmText === 'APPROVE' ? undefined : '1px solid var(--border)',
                    borderRadius: 5, padding: '6px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace',
                    cursor: confirmText === 'APPROVE' ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                  }}
                >
                  {loading ? 'Approving…' : 'Confirm Approve'}
                </button>
                <button
                  onClick={() => { setShowApproveConfirm(false); setConfirmText('') }}
                  style={{
                    background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '6px 12px', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer',
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
              <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Rejection reason (required)
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason for rejection…"
                style={{
                  background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 4,
                  color: 'var(--text)', padding: '7px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12,
                  resize: 'vertical', minHeight: 72, outline: 'none', width: '100%', lineHeight: 1.5,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || loading}
                  className={rejectReason.trim() ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:text-rose-400' : ''}
                  style={{
                    background: rejectReason.trim() ? undefined : 'rgba(74,85,104,0.15)',
                    color: rejectReason.trim() ? undefined : 'var(--text-muted)',
                    border: rejectReason.trim() ? undefined : '1px solid var(--border)',
                    borderRadius: 5, padding: '6px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace',
                    cursor: rejectReason.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                  }}
                >
                  {loading ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                  style={{
                    background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '6px 12px', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer',
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

function HistoryCard({ override: ov }: { override: Override }) {
  const approved = ov.status === 'approved'
  return (
    <div
      className="bg-white/55 border backdrop-blur-xl rounded-lg p-3 mb-2 dark:bg-[#111116]/65"
      style={{ borderColor: 'rgba(232,165,75,0.22)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
          {ov.finding_title}
        </div>
        <span
          className={`font-mono-product badge ${approved ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400'}`}
        >
          {ov.status.toUpperCase()}
        </span>
      </div>
      <div className="font-mono-product" style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
        {ov.actor} · resolved by {ov.resolver ?? '—'} ·{' '}
        {ov.resolved_at
          ? new Date(ov.resolved_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '—'}
      </div>
      {ov.rejection_reason && (
        <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', lineHeight: 1.4 }}>
          Reason: {ov.rejection_reason}
        </div>
      )}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: typeof ShieldAlert; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
      <Icon size={32} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: 8 }} />
      <p className="font-mono-product" style={{ fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
        {message}
      </p>
    </div>
  )
}

// ─── Results Feed ─────────────────────────────────────────────────────────────

interface ResultsFeedProps {
  records: GovernanceRecord[]
  activeTab: ActiveTab
  onTabChange: (t: ActiveTab) => void
  onOpenFilter: () => void
  activeFilterCount: number
}

function ResultsFeed({ records, activeTab, onTabChange, onOpenFilter, activeFilterCount }: ResultsFeedProps) {
  const { pendingOverrides, overrideHistory } = useFindingsStore()

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 12,
    padding: '6px 14px',
    border: active ? '1px solid rgba(255,92,0,0.30)' : '1px solid transparent',
    borderRadius: 5,
    background: active ? 'rgba(255,92,0,0.10)' : 'transparent',
    color: active ? '#FF5C00' : 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontWeight: active ? 500 : 400,
  })

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar space-y-3">
      {/* Toolbar: filter button + count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {activeTab === 'all' && `${records.length.toLocaleString()} records matching query`}
          {activeTab === 'pending' && `${pendingOverrides.length} pending override${pendingOverrides.length !== 1 ? 's' : ''}`}
          {activeTab === 'history' && `${overrideHistory.length} resolved override${overrideHistory.length !== 1 ? 's' : ''}`}
        </div>
        <button
          onClick={onOpenFilter}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: activeFilterCount > 0 ? 'rgba(255,92,0,0.08)' : 'var(--surface-muted)',
            border: `1px solid ${activeFilterCount > 0 ? 'rgba(255,92,0,0.25)' : 'var(--border)'}`,
            borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
            color: activeFilterCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
        >
          <Filter size={12} />
          Filter Records
          {activeFilterCount > 0 && (
            <span
              style={{
                background: 'var(--primary)', color: '#fff',
                borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 600,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
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
              className="bg-[#FF5C00]/10 text-[#FF5C00]"
              style={{ marginLeft: 6, borderRadius: 8, padding: '1px 6px', fontSize: 10 }}
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
              <EmptyState icon={ShieldAlert} message="No records match the current filters. Try adjusting your filter criteria." />
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
              <EmptyState icon={ShieldAlert} message="No pending architecture override requests found." />
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
              <EmptyState icon={ShieldAlert} message="No override history yet. Resolved overrides will appear here." />
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 24 }}>
        <Shield size={40} style={{ color: 'var(--text-muted)' }} />
        <div className="font-mono-product" style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>
          Authentication required to access Audit Intelligence Console.
        </div>
        <button
          onClick={() => openLoginModal('/audit')}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 20px', fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer',
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

interface KpiData {
  total_analyses: number
  violations_blocked_pct: number
  override_rate_pct: number
  resolution_rate_pct: number
  avg_confidence: number
}

export default function AuditPage() {
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS })
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const [records, setRecords] = useState<GovernanceRecord[]>([])
  const [kpi, setKpi] = useState<KpiData>({ total_analyses: 0, violations_blocked_pct: 0, override_rate_pct: 0, resolution_rate_pct: 0, avg_confidence: 0 })
  const [loading, setLoading] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const activeFilterCount =
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    filters.domains.length +
    filters.tiers.length +
    (filters.overrideStatus !== 'all' ? 1 : 0) +
    (filters.confidenceMin > 0 ? 1 : 0) +
    (filters.confidenceMax < 100 ? 1 : 0)

  const fetchKpi = useCallback(async () => {
    try {
      const res = await api.get('/v1/analytics/summary')
      setKpi(res.data)
    } catch {
      // KPIs default to 0 if unavailable
    }
  }, [])

  const fetchFindings = useCallback(async (f: FilterState) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (f.dateFrom) params.dateFrom = f.dateFrom
      if (f.dateTo) params.dateTo = f.dateTo
      if (f.tiers.length > 0) params.tier = f.tiers.map((t) => t.toLowerCase()).join(',')
      if (f.overrideStatus !== 'all') params.override = f.overrideStatus
      if (f.confidenceMin > 0) params.confidenceMin = String(f.confidenceMin)
      if (f.confidenceMax < 100) params.confidenceMax = String(f.confidenceMax)
      const res = await api.get('/v1/findings', { params })
      setRecords(res.data.findings ?? [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKpi()
    fetchFindings(filters)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRunQuery() {
    fetchFindings(filters)
  }

  function handleExport() {
    try {
      window.print()
    } catch (error) {
      console.error('PDF generation failure:', error)
    }
  }

  function handleClearFilters() {
    setFilters({ ...DEFAULT_FILTERS })
    fetchFindings(DEFAULT_FILTERS)
  }

  return (
    <AppShell title="Audit Intelligence Console" breadcrumb="Audit">
      <AuthGate>
        <div className="h-full w-full overflow-hidden flex flex-col bg-[#F8FAFC] dark:bg-[#08080A]">

          {/* Static top header & KPI strip */}
          <div className="flex-shrink-0 p-6 pb-2 space-y-4">
            <motion.div
              className="flex gap-3"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <KpiCard label="Total analyses this month" value={kpi.total_analyses.toLocaleString()} />
              <KpiCard label="Violations blocked pre-PR" value={`${kpi.violations_blocked_pct}%`} />
              <KpiCard label="Override rate" value={`${kpi.override_rate_pct}%`} />
              <KpiCard label="Resolution rate" value={`${kpi.resolution_rate_pct}%`} />
              <KpiCard label="Avg confidence" value={`${Math.round(kpi.avg_confidence * 100)}%`} />
            </motion.div>
          </div>

          {/* Full-width results (filter is now a floating drawer) */}
          <div className="flex-1 min-h-0 flex flex-col px-6 pb-6 w-full">
            <ResultsFeed
              records={records}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onOpenFilter={() => setFilterOpen(true)}
              activeFilterCount={activeFilterCount}
            />
          </div>

        </div>

        {/* Filter drawer */}
        <FilterDrawer
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          filters={filters}
          onChange={setFilters}
          onRun={handleRunQuery}
          onExport={handleExport}
          onClear={handleClearFilters}
        />

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'rgba(0,0,0,0.3)', zIndex: 999,
            }}
          >
            <div className="font-mono-product" style={{ fontSize: 14, color: 'var(--text)' }}>
              Loading…
            </div>
          </div>
        )}
      </AuthGate>
    </AppShell>
  )
}
