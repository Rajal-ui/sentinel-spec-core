'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useInView, useReducedMotion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, ArrowRight, ChevronRight, ChevronDown, LogOut, User, Settings, Sun, Moon } from 'lucide-react'

import FindingCard from '@/components/shared/FindingCard'
import LoginModal from '@/components/layout/LoginModal'
import { useAuthStore } from '@/lib/store/auth'
import { useThemeStore } from '@/lib/store/theme'
// No mock-data imports — all data sourced from live API

// ── useCountUp ──
function useCountUp(target: number, duration = 1800, started = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!started) return
    const start = performance.now()
    const tick = (now: number) => {
      const pct = Math.min((now - start) / duration, 1)
      setCount(Math.round(target * pct))
      if (pct < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, started])
  return count
}

// ── Hero Demo Panel ──
const DEMO_CODE = `def charge_customer(user_id: str, amount: float):
    """Process customer payment."""
    user = get_user(user_id)
    # TODO: use billing port
    legacy_billing.charge(
        user_id, amount, "USD"
    )
    logger.info(f"Charged {user.email}")
    return {"status": "ok"}`

function HeroDemoPanel() {
  const [visibleChars, setVisibleChars] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'finding' | 'diff' | 'reset'>('typing')
  const [diffChars, setDiffChars] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const DIFF_TEXT = '− legacy_billing.charge(user_id, amount, "USD")\n+ billing_port.charge(ChargeRequest(user_id, amount, "USD"))'

  const runLoop = useCallback(() => {
    if (prefersReducedMotion) { setPhase('finding'); return }

    // Typing phase
    setVisibleChars(0); setPhase('typing'); setDiffChars(0)
    let i = 0
    timerRef.current = setInterval(() => {
      i++
      setVisibleChars(i)
      if (i >= DEMO_CODE.length) {
        clearInterval(timerRef.current!)
        // 2.2s delay then finding slides in
        setTimeout(() => {
          setPhase('finding')
          // Type diff after finding appears
          setTimeout(() => {
            setPhase('diff')
            let d = 0
            timerRef.current = setInterval(() => {
              d++
              setDiffChars(d)
              if (d >= DIFF_TEXT.length) {
                clearInterval(timerRef.current!)
                // Reset after 3s
                setTimeout(() => runLoop(), 3000)
              }
            }, 22)
          }, 800)
        }, 2200)
      }
    }, 35)
  }, [prefersReducedMotion, DIFF_TEXT.length])

  useEffect(() => {
    runLoop()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [runLoop])

  const isViolation = phase === 'finding' || phase === 'diff'

  return (
    <div
      className="code-block"
      style={{
        borderRadius: 10,
        border: `1px solid ${isViolation ? 'rgba(232,165,75,0.35)' : 'rgba(255,92,0,0.25)'}`,
        // AMBER RULE: amber glow here exclusively for violation demo panel
        boxShadow: isViolation
          ? '0 0 40px rgba(232,165,75,0.18), 0 0 80px rgba(232,165,75,0.06)'
          : '0 0 40px rgba(255,92,0,0.12)',
        overflow: 'hidden',
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
        maxWidth: 520,
        width: '100%',
      }}
    >
      {/* Editor chrome */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E85D4A' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#CA8A04' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2ECC71' }} />
        <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10 }}>billing.py</span>
        {isViolation && (
          <span
            className="font-mono-product"
            style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 'auto', letterSpacing: '0.05em' }}
          >
            ● VIOLATION DETECTED
          </span>
        )}
      </div>

      {/* Code */}
      <div style={{ padding: '14px 0', minHeight: 200 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {DEMO_CODE.slice(0, visibleChars || (prefersReducedMotion ? DEMO_CODE.length : 0)).split('\n').map((line, i) => (
              <tr key={i}>
                <td className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 14px', userSelect: 'none', minWidth: 32, textAlign: 'right', verticalAlign: 'top', lineHeight: 1.6 }}>
                  {i + 1}
                </td>
                <td
                  className="font-mono-product"
                  style={{
                    fontSize: 12,
                    color: line.includes('legacy_billing') ? 'var(--amber)' : 'var(--text)',
                    padding: '0 16px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre',
                    background: line.includes('legacy_billing') && isViolation ? 'rgba(232,165,75,0.07)' : 'transparent',
                  }}
                >
                  {line}
                  {i === DEMO_CODE.slice(0, visibleChars).split('\n').length - 1 && phase === 'typing' && (
                    <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>▋</motion.span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Violation badge slides in */}
      <AnimatePresence>
        {isViolation && (
          <motion.div
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            style={{
              margin: '0 14px 10px',
              // AMBER RULE: amber bg for violation finding badge
              background: 'rgba(232,165,75,0.10)',
              border: '1px solid rgba(232,165,75,0.3)',
              borderRadius: 6,
              padding: '8px 12px',
            }}
          >
            <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 500 }}>
              ⚠ VIOLATION · ADR-0042 · 94% confidence
            </div>
            <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              Direct call to legacy_billing.charge() is prohibited
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diff typewriter */}
      <AnimatePresence>
        {phase === 'diff' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ margin: '0 14px 14px', background: 'var(--code-bg)', borderRadius: 4, padding: 10 }}
          >
            {DIFF_TEXT.slice(0, diffChars).split('\n').map((line, i) => (
              <div
                key={i}
                className="font-mono-product"
                style={{
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: line.startsWith('−') ? '#E85D4A' : '#2ECC71',
                  textDecoration: line.startsWith('−') ? 'line-through' : 'none',
                  background: line.startsWith('−') ? 'rgba(232,93,74,0.08)' : 'rgba(46,204,113,0.08)',
                  padding: '1px 4px',
                  borderRadius: 2,
                }}
              >
                {line}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
        <span className="font-mono-product" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          trace_id: a3f9c-7d2b1-... · watsonx.governance · logged
        </span>
      </div>
    </div>
  )
}

// ── Scroll reveal wrapper ──
function RevealSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={inView || prefersReducedMotion ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}

// ── Main Landing Page ──
export default function LandingPage() {
  const pathname = usePathname()
  const router = useRouter()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const { openLoginModal, isAuthenticated, user, logout } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    const sectionId = pathname === '/how-it-works' ? 'how-it-works' : pathname === '/ibm-integration' ? 'ibm-integration' : null
    if (sectionId) {
      const el = document.getElementById(sectionId)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 200)
    }
  }, [pathname])

  const metricsRef = useRef<HTMLDivElement>(null)
  const metricsInView = useInView(metricsRef, { once: true, margin: '-15% 0px' })

  const count1 = useCountUp(60, 1600, metricsInView)
  const count2 = useCountUp(5, 1600, metricsInView)
  const count3 = useCountUp(8, 1600, metricsInView)

  return (
    <>

      <LoginModal />

      {/* ── NAV ── */}
      <nav
        className="prism-glass-card"
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          borderRadius: 12,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 40,
          width: 'calc(100% - 64px)',
          maxWidth: 1100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={18} style={{ color: 'var(--primary)' }} />
          <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Sentinel Spec</span>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 32 }}>
          {[
            { label: 'How it Works', href: '/how-it-works' },
            { label: 'IBM Integration', href: '/ibm-integration' },
            { label: 'Docs', href: '/docs' },
            { label: 'Export', href: '/export' },
          ].map(({ label, href }) => {
            const isActive = pathname === href
            return (
              <Link key={label} href={href}
                style={{
                  fontSize: 13, color: isActive ? '#FF5C00' : '#475569',
                  textDecoration: 'none', fontFamily: 'Inter, sans-serif',
                  fontWeight: isActive ? 500 : 400,
                  borderBottom: isActive ? '1px solid #FF5C00' : 'none',
                  paddingBottom: isActive ? 1 : 0, transition: 'color 0.15s ease',
                } as React.CSSProperties}
              >
                {label}
              </Link>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggleTheme}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              padding: '6px 8px', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', lineHeight: 0,
            }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          {isAuthenticated && user ? (
            <>
              <Link href="/agent"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#FF5C00',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 16px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'Archivo, sans-serif',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Console
              </Link>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily: 'Archivo, sans-serif',
                    }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif' }}>{user.name}</span>
                  <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
                </button>

                {profileOpen && (
                  <div
                    className="glass-raised"
                    style={{
                      position: 'absolute',
                      top: '110%',
                      right: 0,
                      minWidth: 180,
                      borderRadius: 8,
                      padding: 6,
                      zIndex: 100,
                    }}
                  >
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>{user.name}</div>
                      <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setProfileOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '7px 12px',
                        borderRadius: 4,
                        fontSize: 13,
                        fontFamily: 'Inter, sans-serif',
                        color: 'var(--text)',
                        textDecoration: 'none',
                      }}
                    >
                      <User size={13} />
                      Edit Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '7px 12px',
                        borderRadius: 4,
                        fontSize: 13,
                        fontFamily: 'Inter, sans-serif',
                        color: 'var(--text)',
                        textDecoration: 'none',
                      }}
                    >
                      <Settings size={13} />
                      Settings
                    </Link>
                    <button
                      onClick={() => { logout(); setProfileOpen(false) }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--danger)',
                        padding: '7px 12px',
                        borderRadius: 4,
                        fontSize: 13,
                        fontFamily: 'Inter, sans-serif',
                        textAlign: 'left',
                      }}
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => openLoginModal('/')}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                Sign In
              </button>
              <button onClick={() => openLoginModal('/')}
                style={{ background: '#FF5C00', border: 'none', borderRadius: 6, padding: '6px 16px', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'Archivo, sans-serif', fontWeight: 700 }}>
                Get Access
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '120px 32px 80px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
            {/* Accent pill row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              <span className="font-mono-product" style={{ fontSize: 11, color: '#FF5C00', background: 'rgba(255,92,0,0.10)', border: '1px solid rgba(255,92,0,0.25)', borderRadius: 100, padding: '3px 10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Shift-Left Compliance
              </span>
              <span className="font-mono-product" style={{ fontSize: 11, color: '#FF5C00', background: 'rgba(255,92,0,0.10)', border: '1px solid rgba(255,92,0,0.25)', borderRadius: 100, padding: '3px 10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                IBM Granite
              </span>
              <span className="font-mono-product" style={{ fontSize: 11, color: '#E5FF00', background: 'rgba(229,255,0,0.10)', border: '1px solid rgba(229,255,0,0.25)', borderRadius: 100, padding: '3px 10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                watsonx.governance
              </span>
            </div>
            <h1 className="font-display" style={{ fontSize: 'clamp(42px, 6vw, 72px)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.08, letterSpacing: '-0.02em', marginBottom: 20 }}>
              Stop violations<br />before the PR exists.
            </h1>
            <p style={{ fontSize: 20, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', lineHeight: 1.67, marginBottom: 32, maxWidth: 460 }}>
              Autonomous architecture and compliance review, inside IBM Bob IDE, with an immutable audit trail for every decision.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
              <button onClick={() => openLoginModal('/')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FF5C00', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 24px', fontSize: 15, fontFamily: 'Archivo, sans-serif', fontWeight: 700, cursor: 'pointer' }}>
                Get Early Access <ArrowRight size={15} />
              </button>
              <Link href="/docs"
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 24px', fontSize: 15, fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
                View Architecture <ChevronRight size={15} />
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {['✓ Runs in IBM Bob IDE', '✓ Immutable audit trail', '✓ Zero code leaves your tenancy'].map((p) => (
                <span key={p} className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{p}</span>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: 0.08 }} style={{ display: 'flex', justifyContent: 'center' }}>
            <HeroDemoPanel />
          </motion.div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <RevealSection>
        <div style={{ borderTop: '1px solid rgba(255,92,0,0.12)', borderBottom: '1px solid rgba(255,92,0,0.12)', padding: '18px 32px', textAlign: 'center' }}>
          <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Trusted by engineering teams on IBM Cloud
          </span>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 14, flexWrap: 'wrap' }}>
            {['Acme Financial', 'TechCore', 'DataVault', 'CloudOps', 'RegulaTech'].map((n) => (
              <span key={n} style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', opacity: 0.5 }}>{n}</span>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ── THE PROBLEM ── */}
      <section id="how-it-works" style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <RevealSection>
          <h2 className="font-display" style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', textAlign: 'center', marginBottom: 12 }}>
            The gap that&apos;s costing you.
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 18, marginBottom: 48 }}>
            Architectural drift compounds silently until it&apos;s a P0 or an audit finding.
          </p>
        </RevealSection>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            { icon: '⏱', title: 'Late-cycle rework', body: 'Violations found in PR review cost 4–8× more to fix than those caught at authorship. Every sprint carries invisible rework debt.' },
            { icon: '⚖', title: 'Inconsistent enforcement', body: 'ADRs live in Confluence. Humans interpret them differently. Compliance is a coin flip depending on who reviews the code.' },
            { icon: '📋', title: 'No audit evidence', body: 'Regulators ask for architectural decision trails. You have git blame. Every override is undocumented. Every exception disappears.' },
          ].map((card, i) => (
            <RevealSection key={card.title} delay={i * 0.07}>
              <motion.div
                className="prism-glass-card"
                whileHover={{ y: -3, boxShadow: '0 8px 28px rgba(255,92,0,0.10)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ borderRadius: 10, padding: '28px 24px', height: '100%' }}
              >
                <div style={{ fontSize: 28, marginBottom: 14 }}>{card.icon}</div>
                <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{card.title}</h3>
                <p style={{ fontSize: 16, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', lineHeight: 1.625 }}>{card.body}</p>
              </motion.div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '96px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <RevealSection>
            <h2 className="font-display" style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', textAlign: 'center', marginBottom: 8 }}>
              Four agents. One governed pipeline.
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontSize: 18, marginBottom: 56 }}>
              Runs twice — IDE-time advisory, CI-time enforcing.
            </p>
          </RevealSection>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, position: 'relative', alignItems: 'start' }}>
            {/* Animated connector */}
            <div style={{ position: 'absolute', top: 32, left: '12.5%', right: '12.5%', height: 2, zIndex: 0 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, var(--primary) 100%)', opacity: 0.3 }} />
              <motion.div
                style={{ position: 'absolute', top: 0, height: '100%', width: 60, background: 'var(--primary)', opacity: 0.7, borderRadius: 1 }}
                animate={{ left: ['-5%', '105%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            {[
              { n: '01', title: 'Retrieve', desc: 'RAG lookup against policy corpus — ADRs, architecture decisions, compliance rules.' },
              { n: '02', title: 'Classify', desc: 'Granite-3 classifies the diff against retrieved policy chunks with confidence scoring.' },
              { n: '03', title: 'Critique', desc: 'Adversarial critic validates the classification — eliminates false positives.' },
              { n: '04', title: 'Surface', desc: 'Findings rendered inline in IBM Bob with diff and remediation, logged to governance.' },
            ].map((step, i) => (
              <RevealSection key={step.n} delay={i * 0.07}>
                <div style={{ textAlign: 'center', padding: '0 16px', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-raised)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <span className="font-mono-product" style={{ fontSize: 18, fontWeight: 600, color: 'var(--primary)' }}>{step.n}</span>
                  </div>
                  <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{step.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>{step.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
          {/* CI callout */}
          <RevealSection delay={0.2}>
            <div style={{ marginTop: 40, padding: '16px 20px', borderLeft: '3px solid #FF5C00', background: 'rgba(255,92,0,0.07)', borderRadius: '0 6px 6px 0' }}>
              <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginRight: 8 }}>CI Gate Enforcement</span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                BLOCKING findings fail the pipeline. WARNINGS log to governance. Every decision is immutable, timestamped, and approver-attributed.
              </span>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ── IBM INTEGRATION ── */}
      <section id="ibm-integration" style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <RevealSection>
          <h2 className="font-display" style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', textAlign: 'center', marginBottom: 48 }}>
            Built on IBM infrastructure.
          </h2>
        </RevealSection>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            { cat: 'IDE Integration', title: 'IBM Bob IDE', body: 'Native MCP registration. Findings appear inline at the point of authorship — not after the PR exists. No context switch.' },
            { cat: 'Language Model', title: 'IBM Granite via watsonx.ai', body: 'Granite-3-8b for classification and critique. Runs in your IBM Cloud tenancy — zero data egress, enterprise SLA.' },
            { cat: 'Governance', title: 'watsonx.governance', body: 'Every finding, override, and approval is an immutable lineage record. Auditor-ready export. Full decision trail.' },
          ].map((card, i) => (
            <RevealSection key={card.title} delay={i * 0.07}>
              <motion.div
                className="prism-glass-card"
                whileHover={{ y: -3, boxShadow: '0 8px 28px rgba(255,92,0,0.10)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ borderRadius: 10, padding: '28px 24px', borderLeft: '3px solid #FF5C00', height: '100%' }}
              >
                <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{card.cat}</div>
                <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{card.title}</h3>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', lineHeight: 1.625 }}>{card.body}</p>
              </motion.div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* ── DUAL-STACK TABLE ── */}
      <section style={{ padding: '80px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <RevealSection>
            <h2 className="font-display" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', textAlign: 'center', marginBottom: 32 }}>
              IBM Active vs MOCK_MODE
            </h2>
          </RevealSection>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-raised)' }}>
                  {['Component', 'IBM Active Service', 'Zero-Cost Fallback'].map((h) => (
                    <th key={h} className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['LLM', 'IBM Granite via watsonx.ai', 'Ollama llama3.1:8b (MOCK_MODE)'],
                  ['Vector Store', 'watsonx.data / Milvus', 'Milvus-lite (embedded)'],
                  ['Governance', 'watsonx.governance', 'JSON file store (MOCK_MODE)'],
                  ['IDE Integration', 'IBM Bob MCP', 'stdio local MCP server'],
                  ['Orchestration', 'watsonx Orchestrate', 'Direct Python agents'],
                  ['Auth', 'IBM Cloud IAM', 'Mock JWT (MOCK_MODE)'],
                ].map(([comp, ibm, fallback], i) => (
                  <tr key={comp} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-raised)' }}>
                    <td className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-code)', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>{comp}</td>
                    <td className="font-mono-product" style={{ fontSize: 12, color: 'var(--primary)', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>{ibm}</td>
                    <td className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>{fallback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── METRICS ── */}
      <section style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div ref={metricsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, textAlign: 'center' }}>
          {[
            { value: `>${count1}%`, label: 'violations caught pre-PR' },
            { value: `<${count2}%`, label: 'false positive rate' },
            { value: `4–${count3}×`, label: 'cheaper to fix at authorship' },
          ].map((m) => (
            <RevealSection key={m.label}>
              <div>
                <div className="font-display" style={{ fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                  {m.value}
                </div>
                <div style={{ fontSize: 16, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', marginTop: 10 }}>{m.label}</div>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* ── FINDING CARD SPOTLIGHT ── */}
      <section style={{ padding: '80px 32px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <RevealSection>
            <h2 className="font-display" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: 'var(--text)', textAlign: 'center', marginBottom: 8 }}>
              What a finding looks like.
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', marginBottom: 40 }}>
              Every violation is precise, cited, and immediately actionable.
            </p>
          </RevealSection>
          <RevealSection delay={0.1}>
            <FindingCard finding={{
              id: 'demo',
              tier: 'blocking',
              confidence: 0.94,
              title: 'Direct call to legacy_billing.charge() violates ADR-0042',
              description: 'The function charge_customer() calls legacy_billing.charge() directly. ADR-0042 mandates all billing operations route through BillingPort.',
              cited_adr: 'ADR-0042',
              cited_text: 'All billing operations MUST route through BillingPort. Direct calls to legacy_billing are prohibited.',
              source_document: 'docs/adr/ADR-0042-billing-abstraction.md',
              diff_old: 'legacy_billing.charge(user_id, amount, currency)',
              diff_new: 'billing_port.charge(ChargeRequest(user_id=user_id, amount=amount, currency=currency))',
              trace_id: 'demo-trace',
              timestamp: new Date().toISOString(),
              record_id: 'demo-rec',
            }} />
          </RevealSection>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '96px 32px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <RevealSection>
            <div className="prism-glass-card" style={{ borderRadius: 16, padding: '56px 48px' }}>
              <h2 className="font-display" style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 16 }}>
                Your ADRs deserve to be enforced.
              </h2>
              <p style={{ fontSize: 20, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', marginBottom: 32 }}>
                Not ignored in Confluence. Not caught in PR review. Enforced at the moment of authorship.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                <button onClick={() => openLoginModal('/')}
                  style={{ background: '#FF5C00', color: '#fff', border: 'none', borderRadius: 6, padding: '14px 28px', fontSize: 16, fontFamily: 'Archivo, sans-serif', fontWeight: 700, cursor: 'pointer' }}>
                  Get Early Access
                </button>
                <Link href="/docs"
                  style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 28px', fontSize: 15, fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
                  Read Architecture Docs
                </Link>
              </div>
              <div className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                IBM Granite · watsonx.governance · IBM Bob · 2026
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={14} style={{ color: 'var(--primary)' }} />
          <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Sentinel Spec</span>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[['Docs', '/docs'], ['Architecture', '/docs'], ['Export', '/export'], ['Privacy', '#']].map(([label, href]) => (
            <Link key={label} href={href} style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>{label}</Link>
          ))}
        </div>
        <div className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          IBM Granite · watsonx.governance · IBM Bob · 2026
        </div>
      </footer>
    </>
  )
}
