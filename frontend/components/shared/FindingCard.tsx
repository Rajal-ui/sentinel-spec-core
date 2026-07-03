'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { Finding } from '@/lib/types'
import StatusBadge from './StatusBadge'
import ConfidenceBar from './ConfidenceBar'
import { useState } from 'react'

interface Props {
  finding: Finding
  onOverride?: (id: string) => void
  onApplyFix?: (id: string) => void
  onViewReasoning?: (id: string) => void
  compact?: boolean
}

export default function FindingCard({ finding, onOverride, onApplyFix, onViewReasoning, compact }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [justification, setJustification] = useState('')

  const tierLabel = {
    blocking: '⚠ POLICY VIOLATION · HIGH',
    warning: '⚠ POLICY VIOLATION · MEDIUM',
    logged_only: '○ POLICY NOTE · LOW',
    rejected: '✓ CLEAN · REJECTED',
  }[finding.tier]

  const confidencePct = Math.round(finding.confidence * 100)

  // AMBER RULE: amber styles only appear here in FindingCard — lint: no-amber-outside-findings
  const borderColor = {
    blocking: 'rgba(232,165,75,0.25)',
    warning: 'rgba(202,138,4,0.25)',
    logged_only: 'rgba(74,85,104,0.4)',
    rejected: 'rgba(74,85,104,0.3)',
  }[finding.tier]

  const glowStyle = {
    blocking: '0 0 28px rgba(232,165,75,0.18)',
    warning: '0 0 16px rgba(202,138,4,0.10)',
    logged_only: 'none',
    rejected: 'none',
  }[finding.tier]

  const pulseAnimation =
    finding.tier === 'blocking' && !prefersReducedMotion
      ? {
          boxShadow: [
            '0 0 16px rgba(232,165,75,0.10)',
            '0 0 28px rgba(232,165,75,0.22)',
            '0 0 16px rgba(232,165,75,0.10)',
          ],
        }
      : {}

  const isPulsing = finding.tier === 'blocking' && !prefersReducedMotion

  return (
    <motion.div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
        border: `1px solid ${borderColor}`,
        boxShadow: glowStyle,
      }}
      whileHover={prefersReducedMotion ? {} : { scale: 1.008 }}
      animate={pulseAnimation}
      transition={
        isPulsing
          ? { duration: 3, repeat: Infinity, ease: 'easeInOut' as const }
          : { type: 'spring', stiffness: 300, damping: 20 }
      }
    >
      {/* Top bar — AMBER RULE: amber text/bg only for blocking/warning */}
      <div
        style={{
          background:
            finding.tier === 'blocking' || finding.tier === 'warning'
              ? 'rgba(232,165,75,0.08)'
              : 'rgba(74,85,104,0.08)',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          className="font-mono-product"
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.04em',
            // AMBER RULE: amber text only for blocking/warning
            color:
              finding.tier === 'blocking' || finding.tier === 'warning'
                ? 'var(--amber)'
                : 'var(--text-muted)',
          }}
        >
          {tierLabel} · {confidencePct}% confidence
        </span>
        <StatusBadge tier={finding.tier} />
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        {/* Finding ID */}
        <div
          className="font-mono-product"
          style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}
        >
          sentinel://finding/{finding.record_id} · {finding.cited_adr}
        </div>

        {/* Title */}
        <h3
          className="font-display"
          style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10, lineHeight: 1.4 }}
        >
          {finding.title}
        </h3>

        {!compact && (
          <>
            {/* Citation block */}
            <div
              className="code-block"
              style={{
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

            {/* Diff block */}
            <div
              className="code-block"
              style={{
                padding: '8px 12px',
                marginBottom: 12,
              }}
            >
              <div className="diff-removed font-mono-product" style={{ fontSize: 13, padding: '2px 4px', borderRadius: 3 }}>
                − {finding.diff_old}
              </div>
              <div className="diff-added font-mono-product" style={{ fontSize: 13, padding: '2px 4px', borderRadius: 3, marginTop: 4 }}>
                + {finding.diff_new}
              </div>
            </div>

            {/* Confidence bar */}
            <ConfidenceBar confidence={finding.confidence} tier={finding.tier} />

            {/* Override form */}
            {showOverrideForm && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Business justification required..."
                  className="font-mono-product"
                  style={{
                    width: '100%',
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text)',
                    padding: '8px 10px',
                    fontSize: 13,
                    resize: 'vertical',
                    minHeight: 64,
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    onClick={() => {
                      if (justification.trim()) {
                        onOverride?.(finding.id)
                        setShowOverrideForm(false)
                        setJustification('')
                      }
                    }}
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontFamily: 'IBM Plex Mono, monospace',
                      cursor: 'pointer',
                    }}
                  >
                    Submit Override
                  </button>
                  <button
                    onClick={() => setShowOverrideForm(false)}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontFamily: 'IBM Plex Mono, monospace',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Footer actions */}
            {!showOverrideForm && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button
                  onClick={() => onApplyFix?.(finding.id)}
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
                  Apply Fix (Reviewable)
                </button>
                <button
                  onClick={() => setShowOverrideForm(true)}
                  style={{
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
                  Override with Justification
                </button>
                <button
                  onClick={() => onViewReasoning?.(finding.id)}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontFamily: 'IBM Plex Mono, monospace',
                    cursor: 'pointer',
                  }}
                >
                  View AI Reasoning
                </button>
              </div>
            )}
          </>
        )}

        {/* Governance trace */}
        <div
          className="font-mono-product"
          style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: compact ? 8 : 14 }}
        >
          trace_id: {finding.trace_id} · logged to watsonx.governance · approver required
        </div>
      </div>
    </motion.div>
  )
}
