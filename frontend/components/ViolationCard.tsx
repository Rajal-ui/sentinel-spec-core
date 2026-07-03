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
    blocking: '\u26A0 POLICY VIOLATION \u00B7 HIGH',
    warning: '\u26A0 POLICY VIOLATION \u00B7 MEDIUM',
    logged_only: '\u25CB POLICY NOTE \u00B7 LOW',
    rejected: '\u2713 CLEAN \u00B7 REJECTED',
  }[finding.tier]

  const confidencePct = Math.round(finding.confidence * 100)

  const borderColor = isResolved
    ? 'rgba(34,197,94,0.25)'
    : {
        blocking: 'rgba(232,165,75,0.25)',
        warning: 'rgba(202,138,4,0.25)',
        logged_only: 'rgba(74,85,104,0.4)',
        rejected: 'rgba(74,85,104,0.3)',
      }[finding.tier]

  const isPulsing = !isResolved && finding.tier === 'blocking' && !prefersReducedMotion

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
      className="rounded-lg overflow-hidden"
      style={{
        background: isResolved ? 'rgba(34,197,94,0.04)' : 'rgba(26,26,35,0.88)',
        backdropFilter: 'blur(12px) saturate(1.4)',
        border: `1px solid ${borderColor}`,
        opacity: isResolved ? 0.8 : 1,
      }}
      animate={
        isPulsing
          ? {
              boxShadow: [
                '0 0 16px rgba(232,165,75,0.10)',
                '0 0 28px rgba(232,165,75,0.22)',
                '0 0 16px rgba(232,165,75,0.10)',
              ],
            }
          : {}
      }
      transition={
        isPulsing
          ? { duration: 3, repeat: Infinity, ease: 'easeInOut' as const }
          : { type: 'spring', stiffness: 300, damping: 20 }
      }
    >
      {/* ── Clickable header ── */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          background: isResolved
            ? 'rgba(34,197,94,0.08)'
            : finding.tier === 'blocking' || finding.tier === 'warning'
              ? 'rgba(232,165,75,0.08)'
              : 'rgba(74,85,104,0.08)',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
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
              color: isResolved
                ? '#22c55e'
                : finding.tier === 'blocking' || finding.tier === 'warning'
                  ? '#E8A54B'
                  : 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {isResolved ? '\u2713 RESOLVED' : `${tierLabel} \u00B7 ${confidencePct}% confidence`}
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
                style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}
              >
                sentinel://finding/{finding.record_id} {'\u00B7'} {finding.cited_adr}
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

              <div
                style={{
                  background: '#0A0C0F',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '10px 12px',
                  marginBottom: 10,
                }}
              >
                <div
                  className="font-mono-product"
                  style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}
                >
                  {finding.source_document}
                </div>
                <p
                  className="font-mono-product"
                  style={{ fontSize: 13, color: 'var(--text-code)', lineHeight: 1.5, margin: 0 }}
                >
                  {finding.cited_text}
                </p>
              </div>

              <div
                style={{
                  background: '#0A0C0F',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '8px 12px',
                  marginBottom: 12,
                }}
              >
                <div
                  className="font-mono-product diff-removed"
                  style={{ fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
                >
                  {'\u2212'} {finding.diff_old}
                </div>
                <div
                  className={`font-mono-product ${isResolved ? 'diff-added' : ''}`}
                  style={{ fontSize: 13, padding: '2px 4px', borderRadius: 3, marginTop: 4 }}
                >
                  + {finding.diff_new}
                </div>
              </div>

              <ConfidenceBar confidence={finding.confidence} tier={finding.tier} />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {!isResolved ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onApplyFix(finding.id) }}
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontFamily: 'IBM Plex Mono, monospace',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Apply Fix
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload() }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
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
                  style={{ fontSize: 11, color: '#22c55e', marginTop: 10 }}
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
                trace_id: {finding.trace_id} {'\u00B7'} logged to watsonx.governance
                {isResolved ? ' \u00B7 fix applied' : ' \u00B7 approver required'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
