'use client'
import type { Finding } from '@/lib/types'
import ViolationCard from '@/components/ViolationCard'

interface AnalysisResultsProps {
  findings: Finding[]
  summary: string
  resolvedFindings: Record<string, { resolved_at: string }>
  onApplyFix: (id: string) => void
  onViewReasoning?: (id: string) => void
}

export default function AnalysisResults({
  findings,
  summary,
  resolvedFindings,
  onApplyFix,
  onViewReasoning,
}: AnalysisResultsProps) {
  if (findings.length === 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}
      >
        <p
          className="font-mono-product"
          style={{ fontSize: 13, color: '#22c55e', margin: 0, lineHeight: 1.5 }}
        >
          {'\u2713'} {summary}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p
        style={{
          fontSize: 15,
          fontFamily: 'Inter, sans-serif',
          color: 'var(--text)',
          lineHeight: 1.65,
          marginBottom: 14,
        }}
      >
        {summary}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {findings.map((finding) => {
          const resolution = resolvedFindings[finding.id]
          return (
            <ViolationCard
              key={finding.id}
              finding={finding}
              isResolved={!!resolution}
              resolvedAt={resolution?.resolved_at ?? null}
              onApplyFix={onApplyFix}
              onViewReasoning={onViewReasoning}
            />
          )
        })}
      </div>
    </div>
  )
}
