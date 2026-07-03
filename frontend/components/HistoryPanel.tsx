'use client'
import { useSessionStore } from '@/lib/store/session'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { StatusLabel } from '@/components/shared/StatusBadge'
import { Trash2 } from 'lucide-react'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
        {sessions.map((session) => (
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
                'group',
                'border-t border-b border-r transition-all duration-200 ease-out',
                activeSessionId === session.id
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
                boxShadow: activeSessionId === session.id
                  ? '0 0 12px rgba(255,92,0,0.10)'
                  : undefined,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {session.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                    padding: 2,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 3,
                }}
              >
                <span
                  className="font-mono-product text-slate-500 dark:text-zinc-400"
                  style={{ fontSize: 11 }}
                >
                  {formatDate(session.created_at)}
                </span>
                <StatusLabel
                  status={
                    session.status === 'PASSED'
                      ? 'PASSED'
                      : session.status === 'VIOLATIONS'
                        ? 'BLOCKING'
                        : 'PENDING'
                  }
                />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
