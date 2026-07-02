'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Shield, MessageSquare, BarChart3, FileText, Package,
  AlertTriangle, CheckCircle, Clock, TrendingUp, ArrowRight,
} from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { useAuthStore } from '@/lib/store/auth'
import { MOCK_FINDINGS, MOCK_OVERRIDES } from '@/lib/mock-data'

const KPI_CARDS = [
  {
    label: 'Findings This Week',
    value: '14',
    delta: '+3 from last week',
    deltaUp: true,
    color: '#FF007A',
    icon: AlertTriangle,
  },
  {
    label: 'Blocking Violations',
    value: '3',
    delta: '2 resolved today',
    deltaUp: false,
    color: '#FF5C00',
    icon: Shield,
  },
  {
    label: 'Capture Rate',
    value: '94%',
    delta: 'pre-PR violations caught',
    deltaUp: true,
    color: '#E5FF00',
    icon: TrendingUp,
  },
  {
    label: 'Avg Resolution',
    value: '47 min',
    delta: '↓12 min from last week',
    deltaUp: false,
    color: '#2ECC71',
    icon: Clock,
  },
]

const QUICK_LINKS = [
  { label: 'Agent Workspace', desc: 'Submit code for compliance review', href: '/agent', icon: MessageSquare, color: '#FF007A' },
  { label: 'Audit Console', desc: 'Review findings and overrides', href: '/audit', icon: Shield, color: '#FF5C00' },
  { label: 'Analytics', desc: 'Trend charts and leaderboards', href: '/analytics', icon: BarChart3, color: '#E5FF00' },
  { label: 'Documentation', desc: 'Architecture and API reference', href: '/docs', icon: FileText, color: '#1B6CA8' },
  { label: 'Export / IDE Skill', desc: 'Bob skill and OpenAPI spec', href: '/export', icon: Package, color: '#8B95A8' },
]

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) router.replace('/')
  }, [isAuthenticated, router])

  if (!isAuthenticated || !user) return null

  const blocking = MOCK_FINDINGS.filter((f) => f.tier === 'blocking')
  const warnings = MOCK_FINDINGS.filter((f) => f.tier === 'warning')
  const recent = MOCK_FINDINGS.slice(0, 3)

  return (
    <AppShell title="Dashboard" breadcrumb={`Welcome back, ${user.name}`}>
      <div style={{ padding: '28px 28px 48px', maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Greeting banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            marginBottom: 28,
            padding: '20px 24px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(255,0,122,0.12) 0%, rgba(255,92,0,0.08) 50%, rgba(229,255,0,0.06) 100%)',
            border: '1px solid rgba(255,0,122,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Welcome back, {user.name} 👋
            </h2>
            <p className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {user.role.replace(/_/g, ' ')} · Sentinel Spec · IBM Bob Workspace
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'BLOCKING', count: blocking.length, color: '#FF007A' },
              { label: 'WARNING', count: warnings.length, color: '#FF5C00' },
            ].map(({ label, count, color }) => (
              <span
                key={label}
                className="font-mono-product"
                style={{
                  fontSize: 11,
                  color,
                  background: `${color}18`,
                  border: `1px solid ${color}40`,
                  borderRadius: 6,
                  padding: '4px 10px',
                }}
              >
                {count} {label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── KPI grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          {KPI_CARDS.map(({ label, value, delta, deltaUp, color, icon: Icon }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.05 }}
              className="glass"
              style={{ borderRadius: 10, padding: '20px 20px', borderTop: `3px solid ${color}` }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>{label}</span>
                <Icon size={16} style={{ color, opacity: 0.8, flexShrink: 0 }} />
              </div>
              <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginBottom: 8 }}>
                {value}
              </div>
              <div className="font-mono-product" style={{ fontSize: 11, color: deltaUp ? color : 'var(--text-muted)' }}>
                {delta}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Two-column: recent findings + quick links ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

          {/* Recent findings */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Recent Findings
              </h3>
              <Link href="/audit" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map((f, i) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="glass"
                  style={{ borderRadius: 8, padding: '14px 16px', borderLeft: `3px solid ${f.tier === 'blocking' ? '#FF007A' : f.tier === 'warning' ? '#FF5C00' : '#4A5568'}` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span
                      className="font-mono-product"
                      style={{
                        fontSize: 10,
                        color: f.tier === 'blocking' ? '#FF007A' : f.tier === 'warning' ? '#FF5C00' : 'var(--text-muted)',
                        background: f.tier === 'blocking' ? 'rgba(255,0,122,0.12)' : f.tier === 'warning' ? 'rgba(255,92,0,0.12)' : 'rgba(74,85,104,0.15)',
                        border: `1px solid ${f.tier === 'blocking' ? 'rgba(255,0,122,0.3)' : f.tier === 'warning' ? 'rgba(255,92,0,0.3)' : 'rgba(74,85,104,0.3)'}`,
                        borderRadius: 4,
                        padding: '2px 7px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {f.tier}
                    </span>
                    <span className="font-mono-product" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {f.cited_adr}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
                    {f.title}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
              Quick Access
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUICK_LINKS.map(({ label, desc, href, icon: Icon, color }, i) => (
                <motion.div
                  key={href}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                >
                  <Link
                    href={href}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'border-color 0.15s' }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{desc}</div>
                    </div>
                    <ArrowRight size={12} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
