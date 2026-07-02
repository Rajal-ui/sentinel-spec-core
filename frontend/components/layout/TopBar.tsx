'use client'
import Link from 'next/link'
import { Bell, Search, ChevronDown, LogOut, Shield, AlertTriangle, TrendingUp, Clock, Home } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store/auth'
import { useFindingsStore } from '@/lib/store/findings'
import { MOCK_FINDINGS, MOCK_KPI } from '@/lib/mock-data'

interface Props {
  title: string
  breadcrumb?: string
}

const STATS = [
  {
    label: 'Blocking',
    value: MOCK_FINDINGS.filter(f => f.tier === 'blocking').length.toString(),
    icon: Shield,
    color: '#FF007A',
  },
  {
    label: 'Capture Rate',
    value: `${MOCK_KPI.violations_blocked_pct}%`,
    icon: TrendingUp,
    color: '#E5FF00',
  },
  {
    label: 'Findings',
    value: String(MOCK_KPI.total_analyses_month),
    icon: AlertTriangle,
    color: '#FF5C00',
  },
  {
    label: 'Avg Resolution',
    value: '47m',
    icon: Clock,
    color: '#2ECC71',
  },
]

export default function TopBar({ title, breadcrumb }: Props) {
  const { user, logout } = useAuthStore()
  const { pendingOverrides } = useFindingsStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)

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

        {/* Right: search + notifications + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Search */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '5px 12px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <Search size={13} />
            <span className="font-mono-product" style={{ fontSize: 12 }}>Cmd+K</span>
          </button>

          {/* Notifications — AMBER RULE: amber count badge for pending findings */}
          <button
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: 4,
            }}
          >
            <Bell size={17} />
            {pendingOverrides.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  // AMBER RULE: amber badge indicates pending findings
                  background: 'var(--amber)',
                  color: '#000',
                  fontSize: 9,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pendingOverrides.length}
              </span>
            )}
          </button>

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
