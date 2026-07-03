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
    'bg-rose-500/10 text-rose-600 border border-rose-500/20 ' +
    'dark:text-rose-400 dark:border-rose-500/10',
  warning:
    'bg-amber-500/10 text-amber-600 border border-amber-500/20 ' +
    'dark:text-amber-400 dark:border-amber-500/10',
  logged_only:
    'bg-zinc-500/10 text-zinc-600 border border-zinc-500/20 ' +
    'dark:text-zinc-400 dark:border-zinc-500/10',
  rejected:
    'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 ' +
    'dark:text-emerald-400 dark:border-emerald-500/10',
}

type StatusType = 'BLOCKING' | 'WARNING' | 'PASSED' | 'PENDING' | 'RESOLVED' | 'OVERRIDDEN' | 'NEEDS REVIEW'

const STATUS_CLASSES: Record<StatusType, string> = {
  BLOCKING:
    'bg-rose-500/10 text-rose-600 border border-rose-500/20 ' +
    'dark:text-rose-400 dark:border-rose-500/10',
  WARNING:
    'bg-amber-500/10 text-amber-600 border border-amber-500/20 ' +
    'dark:text-amber-400 dark:border-amber-500/10',
  PASSED:
    'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 ' +
    'dark:text-emerald-400 dark:border-emerald-500/10',
  PENDING:
    'bg-teal-500/10 text-teal-600 border border-teal-500/20 ' +
    'dark:text-teal-400 dark:border-teal-500/10',
  RESOLVED:
    'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 ' +
    'dark:text-emerald-400 dark:border-emerald-500/10',
  OVERRIDDEN:
    'bg-zinc-500/10 text-zinc-600 border border-zinc-500/20 ' +
    'dark:text-zinc-400 dark:border-zinc-500/10',
  'NEEDS REVIEW':
    'bg-violet-500/10 text-violet-600 border border-violet-500/20 ' +
    'dark:text-violet-400 dark:border-violet-500/10',
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
