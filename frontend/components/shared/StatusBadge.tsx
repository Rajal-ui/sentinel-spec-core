import type { FindingTier } from '@/lib/types'

interface Props { tier: FindingTier; label?: string }

const BADGE_LABELS: Record<FindingTier, string> = {
  blocking: 'BLOCKING',
  warning: 'WARNING',
  logged_only: 'LOGGED ONLY',
  rejected: 'PASSED',
}

const BADGE_CLASSES: Record<FindingTier, string> = {
  blocking:
    'bg-rose-500/10 text-rose-600 ' +
    'dark:text-rose-400',
  warning:
    'bg-amber-500/10 text-amber-600 ' +
    'dark:text-amber-400',
  logged_only:
    'bg-zinc-500/10 text-zinc-600 ' +
    'dark:text-zinc-400',
  rejected:
    'bg-emerald-500/10 text-emerald-600 ' +
    'dark:text-emerald-400',
}

type StatusType = 'BLOCKING' | 'WARNING' | 'PASSED' | 'PENDING' | 'RESOLVED' | 'OVERRIDDEN' | 'NEEDS REVIEW'

const STATUS_CLASSES: Record<StatusType, string> = {
  BLOCKING:
    'bg-rose-500/10 text-rose-600 ' +
    'dark:text-rose-400',
  WARNING:
    'bg-amber-500/10 text-amber-600 ' +
    'dark:text-amber-400',
  PASSED:
    'bg-emerald-500/10 text-emerald-600 ' +
    'dark:text-emerald-400',
  PENDING:
    'bg-teal-500/10 text-teal-600 ' +
    'dark:text-teal-400',
  RESOLVED:
    'bg-emerald-500/10 text-emerald-600 ' +
    'dark:text-emerald-400',
  OVERRIDDEN:
    'bg-zinc-500/10 text-zinc-600 ' +
    'dark:text-zinc-400',
  'NEEDS REVIEW':
    'bg-violet-500/10 text-violet-600 ' +
    'dark:text-violet-400',
}

export default function StatusBadge({ tier, label }: Props) {
  const cls = BADGE_CLASSES[tier]
  const text = label ?? BADGE_LABELS[tier]
  return (
    <span className={`badge ${cls}`}>
      {text}
    </span>
  )
}

export function StatusLabel({ status }: { status: StatusType }) {
  return (
    <span className={`badge ${STATUS_CLASSES[status]}`}>
      {status}
    </span>
  )
}
