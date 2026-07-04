'use client'
import { useSessionStore } from '@/lib/store/session'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Trash2 } from 'lucide-react'

// ── MetricPill ────────────────────────────────────────────────────────────────
// Single glass-tinted counter chip. When `active` is false the pill is fully
// muted so zero-state counts recede and non-zero counts pop visually.

interface MetricPillProps {
  count: number | null
  label: string
  activeClass: string   // Tailwind classes applied when count > 0
}

function MetricPill({ count, label, activeClass }: MetricPillProps) {
  const isActive = count !== null && count > 0
  const isUnknown = count === null

  return (
    <span
      className={[
        'inline-flex items-center font-mono-product',
        'px-1.5 py-0.5 rounded border',
        'text-[10px] font-semibold tracking-wide',
        'backdrop-blur-[12px]',
        'transition-all duration-200',
        isActive
          ? activeClass
          : 'bg-white/5 dark:bg-white/[0.03] text-slate-400 dark:text-zinc-600 border-slate-200/30 dark:border-zinc-800/50 opacity-40',
      ].join(' ')}
    >
      {isUnknown ? '—' : count}&nbsp;{label}
    </span>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── component ─────────────────────────────────────────────────────────────────

export default function HistoryPanel() {
  const { sessions, activeSessionId, setActiveSession, deleteSession } = useSessionStore()
  const prefersReducedMotion = useReducedMotion()

  if (sessions.length === 0) {
    return (
      <div
        className="font-mono-product bg-white/20 dark:bg-zinc-900/10 border border-dashed border-slate-200/40 dark:border-zinc-800/40 backdrop-blur-[8px] rounded-lg"
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '20px 12px',
          lineHeight: 1.6,
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        No analyses yet.{'\n'}Drop some code.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <AnimatePresence initial={false}>
        {sessions.map((session) => {
          const isActive = activeSessionId === session.id
          const isPassed  = session.status === 'PASSED'
          const isPending = session.status === 'PENDING'
          const fnd       = session.status !== 'PENDING' ? (session.finding_count ?? null) : null

          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            >
              <div
                onClick={() => setActiveSession(session.id)}
                className={[
                  'group flex flex-col',
                  'border-t border-b border-r transition-all duration-200 ease-out',
                  isActive
                    ? 'border-l-2 border-l-[#FF5C00] bg-white/50 dark:bg-zinc-900/50 border-t-slate-200/40 border-b-slate-200/40 border-r-slate-200/40 dark:border-t-zinc-800/40 dark:border-b-zinc-800/40 dark:border-r-zinc-800/40'
                    : 'bg-white/20 border border-slate-200/40 dark:bg-zinc-900/10 dark:border-zinc-800/40',
                  'hover:bg-white/60 dark:hover:bg-zinc-900/40',
                  'hover:border-slate-300/80 dark:hover:border-zinc-700/60',
                  'hover:-translate-y-[1px] hover:shadow-sm dark:hover:shadow-none',
                  'backdrop-blur-[8px]',
                  'rounded-md cursor-pointer',
                ].join(' ')}
                style={{
                  padding: '8px 10px',
                  WebkitBackdropFilter: 'blur(8px)',
                  boxShadow: isActive ? '0 0 12px rgba(255,92,0,0.10)' : undefined,
                }}
              >
                {/* ── Row 1: name + delete ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span
                    className="group-hover:text-[#FF5C00] transition-colors duration-150"
                    style={{
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {session.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2, flexShrink: 0 }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* ── Row 2: timestamp ── */}
                <div style={{ marginTop: 3 }}>
                  <span
                    className="font-mono-product text-slate-500 dark:text-zinc-400"
                    style={{ fontSize: 11 }}
                  >
                    {formatDate(session.created_at)}
                  </span>
                </div>

                {/* ── Row 3: metric chip strip ── */}
                <div className="flex flex-wrap items-center gap-1" style={{ marginTop: 6 }}>
                  {isPending ? (
                    // Session created but no analysis run yet
                    <MetricPill
                      count={0}
                      label="PENDING"
                      activeClass="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 dark:border-teal-500/15"
                    />
                  ) : isPassed && fnd === 0 ? (
                    // Clean run — single PASSED pill, all others muted
                    <MetricPill
                      count={1}
                      label="PASSED"
                      activeClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/15"
                    />
                  ) : (
                    <MetricPill
                      count={fnd}
                      label="Fnd"
                      activeClass="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
