'use client'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import type { Finding } from '@/lib/types'
import StatusBadge from '@/components/shared/StatusBadge'
import ConfidenceBar from '@/components/shared/ConfidenceBar'
import { useState, useCallback } from 'react'
import { Download, ChevronDown, ChevronRight } from 'lucide-react'

interface ViolationCardProps {
  finding: Finding
  isResolved: boolean
  resolvedAt: string | null
  onApplyFix: (id: string) => void
}

export default function ViolationCard({
  finding,
  isResolved,
  resolvedAt,
  onApplyFix,
}: ViolationCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const [expanded, setExpanded] = useState(false)

  const tierLabel = {
    blocking: '⚠ POLICY VIOLATION · HIGH',
    warning: '⚠ POLICY VIOLATION · MEDIUM',
    logged_only: '○ POLICY NOTE · LOW',
    rejected: '✓ CLEAN · REJECTED',
  }[finding.tier]

  const confidencePct = Math.round(finding.confidence * 100)

  const borderColor = isResolved
    ? 'rgba(34,197,94,0.30)'
    : {
        blocking: 'rgba(232,93,74,0.28)',
        warning: 'rgba(232,165,75,0.25)',
        logged_only: 'rgba(100,116,139,0.20)',
        rejected: 'rgba(100,116,139,0.15)',
      }[finding.tier]

  const headerBg = isResolved
    ? 'rgba(46,204,113,0.07)'
    : finding.tier === 'blocking'
      ? 'rgba(232,93,74,0.06)'
      : finding.tier === 'warning'
        ? 'rgba(232,165,75,0.06)'
        : 'rgba(148,163,184,0.06)'

  const labelColor = isResolved
    ? 'var(--success)'
    : finding.tier === 'blocking'
      ? 'var(--danger)'
      : finding.tier === 'warning'
        ? 'var(--amber)'
        : 'var(--text-secondary)'

  const handleDownload = useCallback(() => {
    if (!finding.diff_new) return
    const blob = new Blob([finding.diff_new], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fix-${finding.id}.patch`
    a.click()
    URL.revokeObjectURL(url)
  }, [finding])

  return (
    <motion.div
      className="prism-glass-card rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${borderColor}`,
        opacity: isResolved ? 0.82 : 1,
      }}
      whileHover={
        prefersReducedMotion
          ? {}
          : { y: -2, boxShadow: '0 8px 28px rgba(255,92,0,0.08), 0 2px 6px rgba(0,0,0,0.05)' }
      }
      transition={{ type: 'spring', stiffness: 340, damping: 24 }}
    >
      {/* ── Clickable header ── */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          background: headerBg,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: expanded ? '1px solid var(--glass-border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {expanded ? (
            <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          ) : (
            <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          )}
          <span
            className="font-mono-product"
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.04em',
              color: labelColor,
              whiteSpace: 'nowrap',
            }}
          >
            {isResolved ? '✓ RESOLVED' : `${tierLabel} · ${confidencePct}% confidence`}
          </span>
          {!expanded && (
            <span
              style={{
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginLeft: 4,
              }}
            >
              {finding.title}
            </span>
          )}
        </div>
        <StatusBadge tier={finding.tier} />
      </div>

      {/* ── Collapsible body ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 16px 16px' }}>
              <div
                className="font-mono-product"
                style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}
              >
                sentinel://finding/{finding.record_id} {'·'} {finding.cited_adr}
              </div>

              <h3
                className="font-display"
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: isResolved ? 'var(--text-muted)' : 'var(--text)',
                  marginBottom: 10,
                  lineHeight: 1.4,
                  textDecoration: isResolved ? 'line-through' : 'none',
                }}
              >
                {finding.title}
              </h3>

              {/* Cited text block */}
              <div
                className="prism-glass-card"
                style={{
                  borderRadius: 6,
                  padding: '10px 12px',
                  marginBottom: 10,
                }}
              >
                <div
                  className="font-mono-product"
                  style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}
                >
                  {finding.source_document}
                </div>
                <p
                  className="font-mono-product"
                  style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}
                >
                  {finding.cited_text}
                </p>
              </div>

              {/* Diff block */}
              <div
                className="prism-glass-card"
                style={{
                  borderRadius: 6,
                  padding: '8px 12px',
                  marginBottom: 12,
                }}
              >
                <div
                  className="font-mono-product diff-removed"
                  style={{ fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
                >
                  {'−'} {finding.diff_old}
                </div>
                <div
                  className={`font-mono-product ${isResolved ? 'diff-added' : ''}`}
                  style={{ fontSize: 13, padding: '2px 4px', borderRadius: 3, marginTop: 4 }}
                >
                  + {finding.diff_new}
                </div>
              </div>

              <ConfidenceBar confidence={finding.confidence} tier={finding.tier} />

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {!isResolved ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onApplyFix(finding.id) }}
                    className="border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 hover:border-[#FF5C00] hover:text-[#FF5C00] dark:hover:border-[#FF5C00] dark:hover:text-[#FF5C00]"
                    style={{
                      background: 'transparent',
                      borderRadius: 6,
                      padding: '6px 16px',
                      fontSize: 12,
                      fontFamily: 'IBM Plex Mono, monospace',
                      cursor: 'pointer',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      transition: 'border-color 150ms ease, color 150ms ease',
                    }}
                  >
                    Apply Fix
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload() }}
                    className="prism-glass-interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      color: 'var(--text-secondary)',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontFamily: 'IBM Plex Mono, monospace',
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={13} />
                    Download Patch
                  </button>
                )}
              </div>

              {isResolved && resolvedAt && (
                <div
                  className="font-mono-product"
                  style={{ fontSize: 11, color: 'var(--success)', marginTop: 10 }}
                >
                  Resolved at{' '}
                  {new Date(resolvedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}

              <div
                className="font-mono-product"
                style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}
              >
                trace_id: {finding.trace_id} {'·'} logged to watsonx.governance
                {isResolved ? ' · fix applied' : ' · approver required'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
