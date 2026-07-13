'use client'
import AppShell from '@/components/layout/AppShell'
import { useAuthStore } from '@/lib/store/auth'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import StatsRow from '@/components/shared/StatsRow'
import type { StatItem } from '@/components/shared/StatsRow'
import Leaderboard from '@/components/shared/Leaderboard'
import type { LeaderboardRow } from '@/components/shared/Leaderboard'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Cell,
} from 'recharts'
import api from '@/lib/api'

// ── API response types ────────────────────────────────────────────────────────

interface TrendPoint { date: string; blocking: number; warning: number }
interface DomainPoint { domain: string; count: number }
interface OverrideTrendPoint { week: string; rate: number }

interface AnalyticsSummary {
  total_analyses: number
  violations_blocked_pct: number
  override_rate_pct: number
  resolution_rate_pct: number
  avg_confidence: number
  trend_data: TrendPoint[]
  domain_data: DomainPoint[]
  override_trend: OverrideTrendPoint[]
  leaderboard: LeaderboardRow[]
}

// ── Types ──────────────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d' | 'custom'
type GroupBy = 'team' | 'policy_domain' | 'week'

// ── Domain colour map ──────────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  security: '#E85D4A',
  data_residency: '#FF5C00',
  api_contract: '#2ECC71',
  architecture: '#8B95A8',
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function dateRangeToParams(range: DateRange): { dateFrom?: string } {
  if (range === 'custom') return {}
  const now = new Date()
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const from = new Date(now.getTime() - days * 86400000)
  return { dateFrom: from.toISOString() }
}

// ── CSV export ─────────────────────────────────────────────────────────────────

function exportCSV(summary: AnalyticsSummary) {
  const rows: string[][] = []

  rows.push(['Metric', 'Value'])
  rows.push(['Total Analyses', String(summary.total_analyses)])
  rows.push(['Violations Blocked %', String(summary.violations_blocked_pct)])
  rows.push(['Override Rate %', String(summary.override_rate_pct)])
  rows.push(['Resolution Rate %', String(summary.resolution_rate_pct)])
  rows.push(['Avg Confidence', String(summary.avg_confidence)])
  rows.push([])

  if (summary.trend_data.length > 0) {
    rows.push(['Trend Date', 'Blocking', 'Warning'])
    for (const pt of summary.trend_data) {
      rows.push([pt.date, String(pt.blocking), String(pt.warning)])
    }
    rows.push([])
  }

  if (summary.domain_data.length > 0) {
    rows.push(['Domain', 'Count'])
    for (const d of summary.domain_data) {
      rows.push([d.domain, String(d.count)])
    }
    rows.push([])
  }

  if (summary.override_trend.length > 0) {
    rows.push(['Week', 'Override Rate %'])
    for (const o of summary.override_trend) {
      rows.push([o.week, String(o.rate)])
    }
    rows.push([])
  }

  if (summary.leaderboard.length > 0) {
    rows.push(['Service', 'Team', 'Violations', 'Override Rate %', 'Capture Rate %', 'Top Domain'])
    for (const lb of summary.leaderboard) {
      rows.push([lb.repo, lb.team, String(lb.violations), String(lb.override_rate), String(lb.capture_rate), lb.top_domain])
    }
  }

  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sentinel-analytics-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTooltip = ({ active, payload, label, override }: any) => {
  if (!active || !payload) return null
  const rate: number | undefined = payload[0]?.value
  const isHigh = override && rate !== undefined && rate > 5
  return (
    <div
      className="bg-white/55 border border-white/70 backdrop-blur-xl rounded-lg
                 dark:bg-[#111116]/65 dark:border-[#1F2029]/80"
      style={{ borderRadius: 6, padding: '8px 12px' }}
    >
      <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <div key={p.name} className="font-mono-product" style={{ fontSize: 12, color: p.color }}>{p.name}: {p.value}</div>
      ))}
      {override && !isHigh && (
        <div className="font-mono-product" style={{ fontSize: 11, color: '#E85D4A', marginTop: 4 }}>rate: {rate}%</div>
      )}
      {isHigh && (
        <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
          ▲ High override rate — review confidence thresholds
        </div>
      )}
    </div>
  )
}

// ── Chart panel wrapper ────────────────────────────────────────────────────────

interface PanelProps {
  title: string
  subtitle: string
  children: React.ReactNode
  delay?: number
}

function ChartPanel({ title, subtitle, children, delay = 0 }: PanelProps) {
  return (
    <motion.div
      className="bg-white/55 border border-white/70 backdrop-blur-xl shadow-sm rounded-xl p-5 flex flex-col gap-1.5
                 dark:bg-[#111116]/65 dark:border-[#1F2029]/80"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay }}
    >
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
        {title}
      </h2>
      <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
        {subtitle}
      </p>
      <div style={{ marginTop: 12 }}>
        {children}
      </div>
    </motion.div>
  )
}

// ── Top controls ───────────────────────────────────────────────────────────────

const DATE_RANGE_OPTIONS: { id: DateRange; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'custom', label: 'custom' },
]

const GROUP_BY_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: 'team', label: 'Team' },
  { id: 'policy_domain', label: 'Policy Domain' },
  { id: 'week', label: 'Week' },
]

interface TopControlsProps {
  dateRange: DateRange
  groupBy: GroupBy
  customStartDate: string
  customEndDate: string
  onDateRange: (v: DateRange) => void
  onGroupBy: (v: GroupBy) => void
  onCustomDateChange: (which: 'start' | 'end', value: string) => void
  onExport: () => void
}

function TopControls({ dateRange, groupBy, customStartDate, customEndDate, onDateRange, onGroupBy, onCustomDateChange, onExport }: TopControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Date range pills */}
      <div style={{ display: 'flex', gap: 4 }}>
        {DATE_RANGE_OPTIONS.map((opt) => {
          const active = dateRange === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => onDateRange(opt.id)}
              className={`font-mono-product ${
                active
                  ? 'bg-[#FF5C00]/10 text-[#FF5C00] border border-[#FF5C00]/30 font-medium'
                  : 'bg-zinc-900/30 text-zinc-400 border border-zinc-800/60 hover:text-[#FF5C00]'
              }`}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              [{opt.label}]
            </button>
          )
        })}
      </div>

      {/* Custom date picker — slides in below when custom selected */}
      {dateRange === 'custom' && (
        <div
          className="flex items-center gap-2"
          style={{
            padding: '6px 10px',
            background: 'rgba(15,15,20,0.5)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(31,32,41,0.8)',
            borderRadius: 6,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => onCustomDateChange('start', e.target.value)}
            className="dark:[color-scheme:dark]"
            style={{
              background: 'rgba(8,8,10,0.8)',
              border: '1px solid rgba(31,32,41,0.9)',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'IBM Plex Mono, monospace',
              outline: 'none',
            }}
          />
          <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => onCustomDateChange('end', e.target.value)}
            className="dark:[color-scheme:dark]"
            style={{
              background: 'rgba(8,8,10,0.8)',
              border: '1px solid rgba(31,32,41,0.9)',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'IBM Plex Mono, monospace',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Separator */}
      <div style={{ width: 1, height: 22, background: 'var(--border)' }} />

      {/* Group by */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Group by
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {GROUP_BY_OPTIONS.map((opt) => {
            const active = groupBy === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => onGroupBy(opt.id)}
                className={`font-mono-product ${
                  active
                    ? 'bg-[#FF5C00]/10 text-[#FF5C00] border border-[#FF5C00]/30 font-medium'
                    : 'text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-700/60 hover:text-[#FF5C00]'
                }`}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                  background: active ? undefined : 'transparent',
                  transition: 'all 0.12s ease',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Export button */}
      <button
        onClick={onExport}
        className="font-mono-product text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-700/60"
        style={{
          padding: '6px 16px',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
          background: 'transparent',
          transition: 'border-color 0.12s ease, color 0.12s ease',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#FF5C00'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#FF5C00'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = ''
          ;(e.currentTarget as HTMLButtonElement).style.color = ''
        }}
      >
        Export Report
      </button>
    </motion.div>
  )
}

// ── Chart Panel 1: Violation Trend Over Time ───────────────────────────────────

function ViolationTrendPanel({ data }: { data: TrendPoint[] }) {
  return (
    <ChartPanel
      title="Violation Trend Over Time"
      subtitle="blocking + warning violations · rolling 30 days"
      delay={0.08}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,32,41,0.8)" />
          <XAxis
            dataKey="date"
            tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#4A5568' }}
            tickLine={false}
            axisLine={{ stroke: '#1F2029' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#4A5568' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, paddingTop: 8 }}
          />
          <Line
            type="monotone"
            dataKey="blocking"
            name="blocking"
            stroke="#E85D4A"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#E85D4A' }}
          />
          <Line
            type="monotone"
            dataKey="warning"
            name="warning"
            stroke="#CA8A04"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#CA8A04' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}

// ── Chart Panel 3: Override Rate Trend ────────────────────────────────────────

function OverrideRatePanel({ data }: { data: OverrideTrendPoint[] }) {
  const hasHighRate = data.some((d) => d.rate > 5)

  return (
    <ChartPanel
      title="Override Rate Trend"
      subtitle="% of findings overridden per week · goal <5%"
      delay={0.20}
    >
      {/* AMBER RULE: amber indicator only for override rate exceeding goal */}
      {hasHighRate && (
        <div
          className="font-mono-product"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--amber)',
            background: 'rgba(232,165,75,0.08)',
            border: '1px solid rgba(232,165,75,0.22)',
            borderRadius: 4,
            padding: '3px 8px',
            marginBottom: 8,
          }}
        >
          <span>▲</span>
          <span>Override rate exceeds 5% goal in one or more weeks</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,32,41,0.8)" />
          <XAxis
            dataKey="week"
            tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#4A5568' }}
            tickLine={false}
            axisLine={{ stroke: '#1F2029' }}
          />
          <YAxis
            tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#4A5568' }}
            tickLine={false}
            axisLine={false}
            domain={[0, 10]}
          />
          <Tooltip content={<ChartTooltip override />} />
          <ReferenceLine
            y={5}
            stroke="rgba(139,149,168,0.5)"
            strokeDasharray="4 3"
            label={{
              value: 'Goal <5%',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10,
              fill: '#8B95A8',
              position: 'insideTopRight',
            }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            name="rate"
            stroke="#E85D4A"
            strokeWidth={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              const { cx, cy, payload } = props
              if (payload.rate > 5) {
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#E85D4A" stroke="rgba(232,165,75,0.5)" strokeWidth={2} />
              }
              return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#E85D4A" stroke="none" />
            }}
            activeDot={{ r: 5, fill: '#E85D4A' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}

// ── Domain bar custom cell renderer ──────────────────────────────────────────

function DomainBarPanelFilled({ data }: { data: DomainPoint[] }) {
  return (
    <ChartPanel
      title="Violations by Policy Domain"
      subtitle="total violations per domain · all time"
      delay={0.12}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,32,41,0.8)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#4A5568' }}
            tickLine={false}
            axisLine={{ stroke: '#1F2029' }}
          />
          <YAxis
            type="category"
            dataKey="domain"
            tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#8B95A8' }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="count" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.domain}
                fill={DOMAIN_COLORS[entry.domain] ?? '#8B95A8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}

// ── Insight cards ─────────────────────────────────────────────────────────────

function InsightCards({ data }: { data: AnalyticsSummary }) {
  const insights: { id: string; text: string }[] = [
    {
      id: 'i-1',
      text: `${data.leaderboard.length} active service${data.leaderboard.length === 1 ? '' : 's'} · ${data.total_analyses} total analyses this period`,
    },
    {
      id: 'i-2',
      text: `Override rate at ${data.override_rate_pct}%${data.override_rate_pct > 5 ? ' — exceeds 5% goal' : ' — within 5% goal'}`,
    },
    {
      id: 'i-3',
      text:
        data.domain_data.length > 0
          ? `Top violation domain: ${data.domain_data[0].domain} (${data.domain_data[0].count} violations)`
          : 'No domain data available yet',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: 0.32 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
        Automated Insights
      </h3>
      {insights.map((ins, i) => (
        <motion.div
          key={ins.id}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, delay: 0.34 + i * 0.06 }}
          className="bg-white/55 border border-white/70 backdrop-blur-xl rounded-lg
                     dark:bg-[#111116]/65 dark:border-[#1F2029]/80"
          style={{
            borderRadius: 8,
            padding: '12px 14px',
            borderLeft: '3px solid var(--primary)',
          }}
        >
          <p className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
            {ins.text}
          </p>
        </motion.div>
      ))}
    </motion.div>
  )
}

// ── Auth gate ─────────────────────────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, openLoginModal } = useAuthStore()

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 40 }}>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
          Analytics requires sign-in
        </div>
        <p className="font-mono-product" style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 340 }}>
          Access governance metrics, violation trends, and team leaderboards after authenticating.
        </p>
        <button
          onClick={() => openLoginModal('/analytics')}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 24px',
            fontSize: 14,
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Sign In
        </button>
      </div>
    )
  }

  return <>{children}</>
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [groupBy, setGroupBy] = useState<GroupBy>('policy_domain')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const params: { dateFrom?: string; dateTo?: string } = dateRange === 'custom'
        ? { ...(customStartDate ? { dateFrom: customStartDate } : {}), ...(customEndDate ? { dateTo: customEndDate } : {}) }
        : dateRangeToParams(dateRange)
      const res = await api.get('/v1/analytics/summary', { params })
      setSummary(res.data)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [dateRange, customStartDate, customEndDate])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const handleCustomDateChange = useCallback((which: 'start' | 'end', value: string) => {
    if (which === 'start') setCustomStartDate(value)
    else setCustomEndDate(value)
  }, [])

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range)
    if (range !== 'custom') {
      setCustomStartDate('')
      setCustomEndDate('')
    }
  }, [])

  if (loading && !summary) {
    return (
      <AppShell title="Analytics" breadcrumb="governance · metrics · trends">
        <AuthGate>
          <div className="h-full flex items-center justify-center">
            <div className="font-mono-product" style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading analytics…</div>
          </div>
        </AuthGate>
      </AppShell>
    )
  }

  const empty = !summary || summary.total_analyses === 0
  const statsItems: StatItem[] = empty
    ? [
        { label: 'Total Analyses', value: '0', sub: 'this month' },
        { label: 'Violations Blocked', value: '0%', sub: 'of total findings' },
        { label: 'Override Rate', value: '0%', sub: 'below 5% goal' },
        { label: 'Resolution Rate', value: '0%', sub: 'of findings resolved' },
        { label: 'Avg Confidence', value: 'N/A', sub: 'classifier score' },
      ]
    : [
        { label: 'Total Analyses', value: summary!.total_analyses.toLocaleString(), sub: 'this month' },
        { label: 'Violations Blocked', value: `${summary!.violations_blocked_pct}%`, sub: 'of total findings' },
        { label: 'Override Rate', value: `${summary!.override_rate_pct}%`, sub: 'below 5% goal' },
        { label: 'Resolution Rate', value: `${summary!.resolution_rate_pct}%`, sub: 'of findings resolved' },
        { label: 'Avg Confidence', value: `${Math.round(summary!.avg_confidence * 100)}%`, sub: 'classifier score' },
      ]

  const handleExport = () => {
    if (summary) exportCSV(summary)
  }

  return (
    <AppShell title="Analytics" breadcrumb="governance · metrics · trends">
      <AuthGate>
        {/* ── Root: fills the <main> flex-1 container exactly ── */}
        <div className="h-full w-full overflow-hidden flex flex-col bg-[#F8FAFC] dark:bg-[#08080A]">

          {/* ── Top control strip (fixed / non-scrolling) ── */}
          <div className="flex-shrink-0 p-6 space-y-4">
            <StatsRow items={statsItems} />
            <TopControls
              dateRange={dateRange}
              groupBy={groupBy}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onDateRange={handleDateRangeChange}
              onGroupBy={setGroupBy}
              onCustomDateChange={handleCustomDateChange}
              onExport={handleExport}
            />
          </div>

          {/* ── Bottom data canvas: independent scrolling grid ── */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 pt-0 grid grid-cols-1 xl:grid-cols-3 gap-6 content-start">

            {/* Charts: span 2 of 3 xl columns */}
            <div className="xl:col-span-2 flex flex-col gap-6">
              {groupBy === 'week' ? (
                <>
                  <OverrideRatePanel data={summary?.override_trend ?? []} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ViolationTrendPanel data={summary?.trend_data ?? []} />
                    <DomainBarPanelFilled data={summary?.domain_data ?? []} />
                  </div>
                </>
              ) : groupBy === 'team' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ViolationTrendPanel data={summary?.trend_data ?? []} />
                    <DomainBarPanelFilled data={summary?.domain_data ?? []} />
                  </div>
                  <OverrideRatePanel data={summary?.override_trend ?? []} />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DomainBarPanelFilled data={summary?.domain_data ?? []} />
                    <ViolationTrendPanel data={summary?.trend_data ?? []} />
                  </div>
                  <OverrideRatePanel data={summary?.override_trend ?? []} />
                </>
              )}

              {/* Leaderboard */}
              {summary && summary.leaderboard.length > 0 && (
                <Leaderboard rows={summary.leaderboard} groupBy={groupBy} />
              )}
            </div>

            {/* Right rail: insight cards */}
            <div className="flex flex-col gap-6">
              {summary && <InsightCards data={summary} />}
            </div>

          </div>

        </div>
      </AuthGate>
    </AppShell>
  )
}
