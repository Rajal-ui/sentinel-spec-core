import type { FindingTier } from '@/lib/types'

interface Props {
  confidence: number // 0-1
  tier: FindingTier
  showLabel?: boolean
}

// AMBER RULE: amber fill only for HIGH confidence (blocking) — lint: no-amber-outside-findings
export default function ConfidenceBar({ confidence, tier, showLabel = true }: Props) {
  const pct = Math.round(confidence * 100)
  const fillColor =
    tier === 'blocking'
      ? 'var(--amber)' // AMBER RULE: HIGH tier only
      : tier === 'warning'
      ? '#CA8A04'
      : 'var(--text-muted)'

  return (
    <div style={{ marginBottom: 8 }}>
      {showLabel && (
        <div
          className="font-mono-product"
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 4,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Confidence</span>
          <span style={{ color: tier === 'blocking' ? 'var(--amber)' : 'var(--text-secondary)' }}>
            {pct}% · {tier.toUpperCase().replace('_', ' ')}
          </span>
        </div>
      )}
      <div
        style={{
          height: 4,
          background: 'var(--surface-muted)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: fillColor,
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
