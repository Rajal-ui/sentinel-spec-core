'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ThinkingStep {
  step: number
  label: string
  detail: string
  status: 'pending' | 'active' | 'done'
  duration_ms: number | null
}

const DEMO_STEPS: ThinkingStep[] = [
  { step: 1, label: 'Policy Retrieval', detail: '6 chunks found · milvus-lite', status: 'done', duration_ms: 312 },
  { step: 2, label: 'Classification', detail: 'verdict: VIOLATION', status: 'done', duration_ms: 841 },
  { step: 3, label: 'Adversarial Critic', detail: 'entailed: true', status: 'done', duration_ms: 654 },
  { step: 4, label: 'Remediation', detail: 'suggestion generated', status: 'done', duration_ms: 493 },
]

interface Props {
  open: boolean
  onClose: () => void
  steps?: ThinkingStep[]
}

export default function ThinkingDrawer({ open, onClose, steps = DEMO_STEPS }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="glass-raised"
          style={{
            width: 420,
            flexShrink: 0,
            height: '100%',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                AI Reasoning
              </div>
              <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                granite-3-8b · agent pipeline trace
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Steps */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
            {steps.map((step, i) => (
              <div
                key={step.step}
                style={{
                  display: 'flex',
                  gap: 14,
                  marginBottom: i < steps.length - 1 ? 0 : 0,
                  position: 'relative',
                }}
              >
                {/* Connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: `2px solid ${
                        step.status === 'done'
                          ? 'var(--success)'
                          : step.status === 'active'
                          ? 'var(--primary)'
                          : 'var(--border)'
                      }`,
                      background:
                        step.status === 'done'
                          ? 'rgba(46,204,113,0.15)'
                          : step.status === 'active'
                          ? 'rgba(27,108,168,0.15)'
                          : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {step.status === 'done' ? (
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="var(--success)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    ) : step.status === 'active' ? (
                      <motion.div
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }}
                      />
                    ) : (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)' }} />
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 2, marginBottom: 2 }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ paddingBottom: 24, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>
                      0{step.step}
                    </span>
                    <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                      {step.label}
                    </span>
                    {step.duration_ms && (
                      <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {step.duration_ms}ms
                      </span>
                    )}
                  </div>
                  <div className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {step.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
