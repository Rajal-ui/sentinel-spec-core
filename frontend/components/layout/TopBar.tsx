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
          color: '#FF007A',
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
          color: '#E5FF00',
        },
        {
          label: 'Avg Resolution',
          value: 'N/A',
          icon: Clock,
          color: '#2ECC71',
        },
      ]
    : [
        {
          label: 'Total',
          value: dbSummary ? String(dbSummary.total_analyses) : '—',
          icon: Shield,
          color: '#FF007A',
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
          color: '#E5FF00',
        },
        {
          label: 'Override',
          value: dbSummary ? `${dbSummary.override_rate_pct}%` : '—',
          icon: Clock,
          color: '#2ECC71',
        },
      ]

  return (
    <header
      className="glass"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Main bar */}
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Left: home button + title + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              textDecoration: 'none',
              flexShrink: 0,
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
            <span className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {breadcrumb}
            </span>
          )}
        </div>
        </div>

        {/* Right: avatar dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar dropdown */}
          {user && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
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

              {dropdownOpen && (
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
                    onClick={() => setDropdownOpen(false)}
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
                    onClick={() => setDropdownOpen(false)}
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

                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

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
            padding: '0 20px',
            height: 36,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-muted)',
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
                borderRight: i < STATS.length - 1 ? '1px solid var(--border)' : 'none',
                height: '100%',
              }}
            >
              <Icon size={12} style={{ color, flexShrink: 0 }} />
              <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
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
