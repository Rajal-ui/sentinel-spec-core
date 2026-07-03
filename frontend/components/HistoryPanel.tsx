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
        className="font-mono-product"
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '20px 12px',
          border: '1px dashed var(--border)',
          borderRadius: 8,
          lineHeight: 1.6,
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
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '8px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                border: `1px solid ${activeSessionId === session.id ? 'rgba(27,108,168,0.4)' : 'var(--border)'}`,
                background: activeSessionId === session.id
                  ? 'rgba(27,108,168,0.08)'
                  : 'var(--surface)',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (activeSessionId !== session.id) {
                  (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)'
                }
              }}
              onMouseLeave={(e) => {
                if (activeSessionId !== session.id) {
                  (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)'
                }
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
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
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
                }}
              >
                <span
                  className="font-mono-product"
                  style={{ fontSize: 11, color: 'var(--text-muted)' }}
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
