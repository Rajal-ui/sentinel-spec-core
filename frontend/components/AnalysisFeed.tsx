'use client'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useSessionStore } from '@/lib/store/session'
import AnalysisResults from '@/components/AnalysisResults'
import { Markdown } from '@/lib/markdown'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StreamingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-block',
        width: 2,
        height: 14,
        background: 'var(--primary)',
        borderRadius: 1,
        verticalAlign: 'middle',
        marginLeft: 4,
      }}
    />
  )
}

interface AnalysisFeedProps {
  onApplyFix: (id: string) => void
}

export default function AnalysisFeed({ onApplyFix }: AnalysisFeedProps) {
  const { messages, isStreaming, resolvedFindings, activeSessionId, selectedFileFilter } = useSessionStore()
  const prefersReducedMotion = useReducedMotion()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!prefersReducedMotion) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      bottomRef.current?.scrollIntoView()
    }
  }, [messages, isStreaming, prefersReducedMotion])

  const sessionResolvedMap = activeSessionId
    ? resolvedFindings[activeSessionId] ?? {}
    : {}

  const isEmpty = messages.length === 0 && !isStreaming

  if (isEmpty) {
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820, margin: '0 auto', width: '100%' }}>
      <AnimatePresence initial={false}>
        {messages.map((msg, idx) => {
          // Retrieve the ingestion context from the preceding user message
          const prevMsg = idx > 0 ? messages[idx - 1] : null
          const originalCode = prevMsg?.originalCode
          const fileName = prevMsg?.fileName
          return (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.role === 'user' ? (
              <div
                className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-[12px]"
                style={{
                  maxWidth: '68%',
                  padding: '11px 15px',
                  borderRadius: 12,
                  borderBottomRightRadius: 3,
                  fontSize: 15,
                  fontFamily: 'Inter, sans-serif',
                  color: 'var(--text)',
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                  WebkitBackdropFilter: 'blur(12px) saturate(1.5)',
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div style={{ flex: 1, maxWidth: '92%', minWidth: 0 }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
                >
                  <span
                    className="font-mono-product"
                    style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {msg.findings && msg.findings.length > 0 ? (
                  <AnalysisResults
                    findings={selectedFileFilter ? msg.findings.filter((f) => f.filename === selectedFileFilter) : msg.findings}
                    summary={msg.content}
                    resolvedFindings={sessionResolvedMap}
                    onApplyFix={onApplyFix}
                    originalCode={originalCode}
                    fileName={fileName}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: 15,
                      fontFamily: 'Inter, sans-serif',
                      color: 'var(--text)',
                      lineHeight: 1.65,
                    }}
                  >
                    <Markdown content={msg.content} />
                    {msg.is_streaming && <StreamingCursor />}
                  </div>
                )}
              </div>
              )}
            </motion.div>
            )
          })}
      </AnimatePresence>

      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 0.15, 0.3].map((delay) => (
                <motion.span
                  key={delay}
                  animate={prefersReducedMotion ? {} : { opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay,
                    ease: 'easeInOut',
                  }}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    display: 'inline-block',
                  }}
                />
              ))}
            </div>
            <span
              className="font-mono-product"
              style={{ fontSize: 12, color: 'var(--text-muted)' }}
            >
              Analyzing...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={bottomRef} />
    </div>
  )
}
