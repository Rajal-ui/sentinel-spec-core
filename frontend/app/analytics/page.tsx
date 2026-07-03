'use client'
import AppShell from '@/components/layout/AppShell'
import { useAuthStore } from '@/lib/store/auth'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Cell,
} from 'recharts'
import api from '@/lib/api'

// ── API response types ────────────────────────────────────────────────────────

interface TrendPoint { date: string; blocking: number; warning: number }
interface DomainPoint { domain: string; count: number }
interface OverrideTrendPoint { week: string; rate: number }
interface LeaderboardRow {
  repo: string
  team: string
  violations: number
  override_rate: number
  capture_rate: number
  top_domain: string
}

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
type GroupBy = 'repo' | 'team' | 'policy_domain' | 'week'
type SortKey = 'repo' | 'team' | 'violations' | 'override_rate' | 'capture_rate' | 'top_domain'
type SortDir = 'asc' | 'desc'

// ── Domain colour map ──────────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  security: '#E85D4A',
  data_residency: '#FF007A',
  api_contract: '#2ECC71',
  architecture: '#8B95A8',
}

// ── Custom dark tooltip ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null
  return (
    <div style={{ background: '#111116', border: '1px solid #1F2029', borderRadius: 6, padding: '8px 12px' }}>
      <div className="font-mono-product" style={{ fontSize: 11, color: '#8B95A8', marginBottom: 4 }}>{label}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <div key={p.name} className="font-mono-product" style={{ fontSize: 12, color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

// ── Override tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OverrideTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload[0]) return null
  const rate: number = payload[0].value
  const isHigh = rate > 5
  return (
    <div style={{ background: '#111116', border: '1px solid #1F2029', borderRadius: 6, padding: '8px 12px' }}>
      <div className="font-mono-product" style={{ fontSize: 11, color: '#8B95A8', marginBottom: 4 }}>{label}</div>
      <div className="font-mono-product" style={{ fontSize: 12, color: '#E85D4A' }}>rate: {rate}%</div>
      {isHigh && (
        <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
          High override rate — review confidence thresholds
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
      className="glass"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay }}
      style={{ borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}
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

// ── KPI strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ data }: { data: AnalyticsSummary }) {
  const items = [
    { label: 'Total Analyses', value: data.total_analyses.toLocaleString(), sub: 'this month' },
    { label: 'Violations Blocked', value: `${data.violations_blocked_pct}%`, sub: 'of total findings' },
    { label: 'Override Rate', value: `${data.override_rate_pct}%`, sub: 'below 5% goal' },
    { label: 'Resolution Rate', value: `${data.resolution_rate_pct}%`, sub: 'of findings resolved' },
    { label: 'Avg Confidence', value: `${Math.round(data.avg_confidence * 100)}%`, sub: 'classifier score' },
  ]
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 12,
        marginBottom: 20,
      }}
    >
      {items.map((k, i) => (
        <motion.div
          key={k.label}
          className="glass"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: i * 0.05 }}
          style={{ borderRadius: 8, padding: '14px 16px' }}
        >
          <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {k.label}
          </div>
          <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
            {k.value}
          </div>
          <div className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            {k.sub}
          </div>
        </motion.div>
      ))}
    </div>
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
  { id: 'repo', label: 'Repo' },
  { id: 'team', label: 'Team' },
  { id: 'policy_domain', label: 'Policy Domain' },
  { id: 'week', label: 'Week' },
]

interface TopControlsProps {
  dateRange: DateRange
  groupBy: GroupBy
  onDateRange: (v: DateRange) => void
  onGroupBy: (v: GroupBy) => void
}

function TopControls({ dateRange, groupBy, onDateRange, onGroupBy }: TopControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
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
              className="font-mono-product"
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'rgba(255,0,122,0.18)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 0.12s ease',
                fontWeight: active ? 600 : 400,
              }}
            >
              [{opt.label}]
            </button>
          )
        })}
      </div>

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
                className="font-mono-product"
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'rgba(255,0,122,0.18)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--text-muted)',
                  transition: 'all 0.12s ease',
                  fontWeight: active ? 600 : 400,
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
        className="font-mono-product"
        style={{
          padding: '6px 16px',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          transition: 'border-color 0.12s ease, color 0.12s ease',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
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
          <Tooltip content={<CustomTooltip />} />
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

// ── Chart Panel 3: Pre-PR Capture Rate ────────────────────────────────────────

function CaptureRatePanel({ data }: { data: Array<{ week: string; ide_time: number; ci_time: number; missed: number }> }) {
  return (
    <ChartPanel
      title="Pre-PR Capture Rate"
      subtitle="violations caught before PR open · ide_time + ci_time + missed"
      delay={0.16}
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="ideGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF007A" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#FF007A" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B95A8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8B95A8" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="missedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgba(74,85,104,0.3)" stopOpacity={1} />
              <stop offset="95%" stopColor="rgba(74,85,104,0.3)" stopOpacity={0.3} />
            </linearGradient>
          </defs>
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
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, paddingTop: 8 }} />
          <ReferenceLine
            y={60}
            stroke="rgba(139,149,168,0.5)"
            strokeDasharray="4 3"
            label={{
              value: 'Goal 60%',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10,
              fill: '#8B95A8',
              position: 'insideTopRight',
            }}
          />
          <Area
            type="monotone"
            dataKey="ide_time"
            name="ide_time"
            stackId="1"
            stroke="#FF007A"
            strokeWidth={1.5}
            fill="url(#ideGradient)"
          />
          <Area
            type="monotone"
            dataKey="ci_time"
            name="ci_time"
            stackId="1"
            stroke="#8B95A8"
            strokeWidth={1.5}
            fill="url(#ciGradient)"
          />
          <Area
            type="monotone"
            dataKey="missed"
            name="missed"
            stackId="1"
            stroke="rgba(74,85,104,0.6)"
            strokeWidth={1}
            fill="url(#missedGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}

// ── Chart Panel 4: Override Rate Trend ────────────────────────────────────────

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
          <Tooltip content={<OverrideTooltip />} />
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

// ── Domain bar custom cell renderer (fills each bar with its domain colour) ───

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
          <Tooltip content={<CustomTooltip />} />
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

// ── Leaderboard table ──────────────────────────────────────────────────────────

function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('violations')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const COLS: { key: SortKey; label: string }[] = [
    { key: 'repo', label: 'Repo' },
    { key: 'team', label: 'Team' },
    { key: 'violations', label: 'Violations' },
    { key: 'override_rate', label: 'Override Rate %' },
    { key: 'capture_rate', label: 'Capture Rate %' },
    { key: 'top_domain', label: 'Top Domain' },
  ]

  return (
    <motion.div
      className="glass"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: 0.28 }}
      style={{ borderRadius: 10, padding: 20, marginTop: 20 }}
    >
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
        Team / Repo Leaderboard
      </h2>
      <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        click row to view audit detail · click header to sort
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr>
              {COLS.map((col) => {
                const active = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="font-mono-product"
                    style={{
                      padding: '8px 10px',
                      textAlign: 'left',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: active ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                    {active && (
                      <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.repo}
                onClick={() => router.push('/audit')}
                style={{
                  cursor: 'pointer',
                  borderBottom: i < sorted.length - 1 ? '1px solid rgba(31,32,41,0.6)' : 'none',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-raised)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                }}
              >
                <td
                  className="font-mono-product"
                  style={{ padding: '10px 10px', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {row.repo}
                </td>
                <td style={{ padding: '10px 10px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                  {row.team}
                </td>
                <td
                  className="font-mono-product"
                  style={{ padding: '10px 10px', fontSize: 13, color: 'var(--text)', textAlign: 'right' }}
                >
                  {row.violations}
                </td>
                <td
                  className="font-mono-product"
                  style={{
                    padding: '10px 10px',
                    fontSize: 13,
                    textAlign: 'right',
                    color: 'var(--text)',
                  }}
                >
                  {row.override_rate}%
                </td>
                <td
                  className="font-mono-product"
                  style={{ padding: '10px 10px', fontSize: 13, color: 'var(--success)', textAlign: 'right' }}
                >
                  {row.capture_rate}%
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <span
                    className="font-mono-product"
                    style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 4,
                      border: `1px solid ${DOMAIN_COLORS[row.top_domain] ?? 'var(--border)'}`,
                      color: DOMAIN_COLORS[row.top_domain] ?? 'var(--text-muted)',
                      background: `${DOMAIN_COLORS[row.top_domain] ?? 'transparent'}18`,
                    }}
                  >
                    {row.top_domain}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

// ── Insight cards ─────────────────────────────────────────────────────────────

function InsightCards({ data }: { data: AnalyticsSummary }) {
  const insights: { id: string; text: string }[] = [
    {
      id: 'i-1',
      text: `${data.leaderboard.length} tracked repos · ${data.total_analyses} total analyses this period`,
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
          className="glass"
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
  const [groupBy, setGroupBy] = useState<GroupBy>('repo')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/v1/analytics/summary')
      setSummary(res.data)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Slice trend data based on selected date range
  const trendData = summary?.trend_data ?? []
  const slicedTrend = dateRange === '7d'
    ? trendData.slice(-7)
    : dateRange === '90d'
      ? trendData
      : trendData

  if (loading) {
    return (
      <AppShell title="Analytics" breadcrumb="governance · metrics · trends">
        <AuthGate>
          <div style={{ padding: '24px 28px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <div className="font-mono-product" style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading analytics…</div>
          </div>
        </AuthGate>
      </AppShell>
    )
  }

  return (
    <AppShell title="Analytics" breadcrumb="governance · metrics · trends">
      <AuthGate>
        <div style={{ padding: '24px 28px', maxWidth: 1600, margin: '0 auto' }}>

          {/* KPI strip */}
          {summary && <KpiStrip data={summary} />}

          {/* Top controls */}
          <TopControls
            dateRange={dateRange}
            groupBy={groupBy}
            onDateRange={setDateRange}
            onGroupBy={setGroupBy}
          />

          {/* Main content: charts (left/centre) + insights (right rail) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 280px',
              gap: 20,
              alignItems: 'start',
            }}
          >
            {/* Left column: 2×2 chart grid + leaderboard */}
            <div>
              {/* 2×2 chart grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 16,
                }}
              >
                <ViolationTrendPanel data={slicedTrend} />
                <DomainBarPanelFilled data={summary?.domain_data ?? []} />
                <OverrideRatePanel data={summary?.override_trend ?? []} />
              </div>

              {/* Leaderboard */}
              {summary && summary.leaderboard.length > 0 && (
                <Leaderboard rows={summary.leaderboard} />
              )}
            </div>

            {/* Right rail: insight cards */}
            <div style={{ position: 'sticky', top: 20 }}>
              {summary && <InsightCards data={summary} />}
            </div>
          </div>

        </div>

        {/* ── Responsive: collapse to single column below 900px ── */}
        <style>{`
          @media (max-width: 900px) {
            .analytics-outer-grid {
              grid-template-columns: 1fr !important;
            }
            .analytics-chart-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </AuthGate>
    </AppShell>
  )
}
