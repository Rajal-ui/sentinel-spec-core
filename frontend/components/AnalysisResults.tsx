'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Finding } from '@/lib/types'
import ViolationCard from '@/components/ViolationCard'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface AnalysisResultsProps {
  findings: Finding[]
  summary: string
  resolvedFindings: Record<string, { resolved_at: string }>
  onApplyFix: (id: string) => void
  originalCode?: string
  fileName?: string
}

export default function AnalysisResults({
  findings,
  summary,
  resolvedFindings,
  onApplyFix,
  originalCode,
  fileName,
}: AnalysisResultsProps) {
  const [expanded, setExpanded] = useState(false)

  if (findings.length === 0) {
    return (
      <div
        className="prism-glass-card"
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid rgba(46,204,113,0.3)',
        }}
      >
        <p
          className="font-mono-product"
          style={{ fontSize: 13, color: 'var(--success)', margin: 0, lineHeight: 1.5 }}
        >
          {'\u2713'} {summary}
        </p>
      </div>
    )
  }

  return (
    <div
      className="prism-glass-card"
      style={{
        border: '1px solid var(--glass-border)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--glass-bg)',
      }}
    >
      {/* ── Accordion header ── */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: expanded ? '1px solid var(--glass-border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {expanded ? (
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          ) : (
            <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          )}
          <span
            className="font-mono-product"
            style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}
          >
            {findings.length} violation{findings.length !== 1 ? 's' : ''} found
          </span>
          <span
            className="font-mono-product"
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary.length > 120 ? `${summary.slice(0, 120)}...` : summary}
          </span>
        </div>
      </div>

      {/* ── Collapsible body ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 14px 16px' }}>
              <p
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  color: 'var(--text)',
                  lineHeight: 1.6,
                  marginBottom: 14,
                  marginTop: 0,
                }}
              >
                {summary}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {findings.map((finding) => {
                  const resolution = resolvedFindings[finding.id]
                  return (
                    <ViolationCard
                      key={finding.id}
                      finding={finding}
                      isResolved={!!resolution}
                      resolvedAt={resolution?.resolved_at ?? null}
                      onApplyFix={onApplyFix}
                      originalCode={originalCode}
                      fileName={fileName}
                    />
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
