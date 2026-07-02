import type { FindingTier } from '@/lib/types'

interface Props { tier: FindingTier; label?: string }

// AMBER RULE: amber styles exclusively for BLOCKING/WARNING — lint: no-amber-outside-findings
const BADGE_STYLES: Record<FindingTier, React.CSSProperties> = {
  blocking: {
    background: 'rgba(220,38,38,0.15)',
    color: '#E85D4A',
    borderColor: 'rgba(220,38,38,0.3)',
  },
  warning: {
    // AMBER RULE: amber used here for WARNING badge only
    background: 'rgba(232,165,75,0.15)',
    color: 'var(--amber)',
    borderColor: 'rgba(232,165,75,0.3)',
  },
  logged_only: {
    background: 'rgba(74,85,104,0.15)',
    color: 'var(--text-muted)',
    borderColor: 'rgba(74,85,104,0.3)',
  },
  rejected: {
    background: 'rgba(46,204,113,0.15)',
    color: 'var(--success)',
    borderColor: 'rgba(46,204,113,0.3)',
  },
}

const BADGE_LABELS: Record<FindingTier, string> = {
  blocking: 'BLOCKING',
  warning: 'WARNING',
  logged_only: 'LOGGED ONLY',
  rejected: 'PASSED',
}

type StatusType = 'BLOCKING' | 'WARNING' | 'PASSED' | 'PENDING' | 'OVERRIDDEN' | 'NEEDS REVIEW'
const STATUS_STYLES: Record<StatusType, React.CSSProperties> = {
  BLOCKING: { background: 'rgba(220,38,38,0.15)', color: '#E85D4A', borderColor: 'rgba(220,38,38,0.3)' },
  // AMBER RULE: amber for WARNING status badge only
  WARNING: { background: 'rgba(232,165,75,0.15)', color: 'var(--amber)', borderColor: 'rgba(232,165,75,0.3)' },
  PASSED: { background: 'rgba(46,204,113,0.15)', color: 'var(--success)', borderColor: 'rgba(46,204,113,0.3)' },
  PENDING: { background: 'rgba(27,108,168,0.15)', color: 'var(--primary)', borderColor: 'rgba(27,108,168,0.3)' },
  OVERRIDDEN: { background: 'rgba(74,85,104,0.15)', color: 'var(--text-muted)', borderColor: 'rgba(74,85,104,0.3)' },
  'NEEDS REVIEW': { background: 'rgba(124,92,216,0.15)', color: '#9B7EDB', borderColor: 'rgba(124,92,216,0.3)' },
}

export default function StatusBadge({ tier, label }: Props) {
  const style = BADGE_STYLES[tier]
  const text = label ?? BADGE_LABELS[tier]
  return (
    <span className="badge" style={style}>
      {text}
    </span>
  )
}

export function StatusLabel({ status }: { status: StatusType }) {
  return (
    <span className="badge" style={STATUS_STYLES[status]}>
      {status}
    </span>
  )
}
