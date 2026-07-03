'use client'
import Link from 'next/link'
import { ChevronDown, LogOut, Shield, AlertTriangle, TrendingUp, Clock, Home, User, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth'
import { useSessionStore } from '@/lib/store/session'
import api from '@/lib/api'

interface Props {
  title: string
  breadcrumb?: string
}

interface DbSummary {
  total_analyses: number
  violations_blocked_pct: number
  resolution_rate_pct: number
  override_rate_pct: number
}

export default function TopBar({ title, breadcrumb }: Props) {
  const { user, logout } = useAuthStore()
  const { messages, activeSessionId, resolvedFindings } = useSessionStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dbSummary, setDbSummary] = useState<DbSummary | null>(null)

  // ── Fetch aggregate DB metrics for fallback display ──
  useEffect(() => {
    let cancelled = false
    api.get('/v1/analytics/summary').then((res) => {
      if (!cancelled) setDbSummary(res.data)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── KPI metrics: session-local when active, DB aggregate fallback ──

  const allFindings = messages.flatMap((m) => m.findings ?? [])
  const totalFindings = allFindings.length
  const hasActiveSession = totalFindings > 0 && !!activeSessionId

  const blockingCount = allFindings.filter(
    (f) => f.tier === 'blocking'
  ).length

  const sessionResolutions = activeSessionId
    ? resolvedFindings[activeSessionId] ?? {}
    : {}

  const unresolvedBlocking = allFindings.filter(
    (f) => f.tier === 'blocking' && !sessionResolutions[f.id]
  ).length

  const STATS = hasActiveSession
    ? [
        {
          label: 'Blocking',
          value: unresolvedBlocking > 0 ? String(unresolvedBlocking) : blockingCount > 0 ? '0' : '0',
          icon: Shield,
          color: '#E85D4A',
        },
        {
          label: 'Findings',
          value: totalFindings > 0 ? String(totalFindings) : '0',
          icon: AlertTriangle,
          color: '#FF5C00',
        },
        {
          label: 'Capture Rate',
          value: 'N/A',
          icon: TrendingUp,
          color: '#2ECC71',
        },
        {
          label: 'Avg Resolution',
          value: 'N/A',
          icon: Clock,
          // AMBER RULE: amber for resolution metrics in KPI strip — lint: no-amber-outside-findings
          color: 'var(--amber)',
        },
      ]
    : [
        {
          label: 'Total',
          value: dbSummary ? String(dbSummary.total_analyses) : '—',
          icon: Shield,
          color: '#E85D4A',
        },
        {
          label: 'Blocked',
          value: dbSummary ? `${dbSummary.violations_blocked_pct}%` : '—',
          icon: AlertTriangle,
          color: '#FF5C00',
        },
        {
          label: 'Resolved',
          value: dbSummary ? `${dbSummary.resolution_rate_pct}%` : '—',
          icon: TrendingUp,
          color: '#2ECC71',
        },
        {
          label: 'Override',
          value: dbSummary ? `${dbSummary.override_rate_pct}%` : '—',
          icon: Clock,
          // AMBER RULE: amber for override rate indicators — lint: no-amber-outside-findings
          color: 'var(--amber)',
        },
      ]

  return (
    <header
      className="w-full max-w-[100vw] px-6 mx-auto sticky top-0 z-50 transition-all bg-white/60 dark:bg-[#08080A]/60 backdrop-blur-xl border-b border-slate-200/40 dark:border-zinc-800/40"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Main bar */}
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        {/* Left: home button + title + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/"
            className="prism-glass-interactive"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              color: 'var(--text)',
              cursor: 'pointer',
              textDecoration: 'none',
              flexShrink: 0,
              transition: 'background 150ms ease',
            }}
            title="Home"
          >
            <Home size={15} />
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <h1 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {title}
            </h1>
            {breadcrumb && (
              <span className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {breadcrumb}
              </span>
            )}
          </div>
        </div>

        {/* Right: avatar dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="prism-glass-interactive"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 8,
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
                    background: '#FF5C00',
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
                <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', color: 'var(--text)' }}>{user.name}</span>
                <ChevronDown size={12} style={{ color: 'var(--text-secondary)' }} />
              </button>

              {dropdownOpen && (
                <div
                  className="bg-white/70 backdrop-blur-md border border-white/60 shadow-lg dark:bg-[#111116]/80 dark:backdrop-blur-md dark:border-[#1F2029]/80"
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    minWidth: 180,
                    borderRadius: 10,
                    padding: 6,
                    zIndex: 100,
                  }}
                >
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--glass-border)', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>{user.name}</div>
                    <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user.email}</div>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '7px 12px',
                      borderRadius: 6,
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
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '7px 12px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                      color: 'var(--text)',
                      textDecoration: 'none',
                    }}
                  >
                    <Settings size={13} />
                    Settings
                  </Link>

                  <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />

                  <button
                    onClick={() => { logout(); setDropdownOpen(false) }}
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
                      borderRadius: 6,
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
          )}
        </div>
      </div>

      {/* KPI stats strip — only when logged in */}
      {user && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            height: 36,
            overflow: 'hidden',
          }}
        >
          {STATS.map(({ label, value, icon: Icon, color }, i) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 14px',
                borderRight: i < STATS.length - 1 ? '1px solid var(--glass-border)' : 'none',
                height: '100%',
              }}
            >
              <Icon size={12} style={{ color, flexShrink: 0 }} />
              <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {label}
              </span>
              <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
