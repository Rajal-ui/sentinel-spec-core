'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

export interface LeaderboardRow {
  repo: string
  team: string
  violations: number
  override_rate: number
  capture_rate: number
  top_domain: string
}

type SortKey = 'repo' | 'team' | 'violations' | 'override_rate' | 'capture_rate' | 'top_domain'
type SortDir = 'asc' | 'desc'

const DOMAIN_COLORS: Record<string, string> = {
  security: '#E85D4A',
  data_residency: '#FF007A',
  api_contract: '#2ECC71',
  architecture: '#8B95A8',
}

interface LeaderboardProps {
  rows: LeaderboardRow[]
  groupBy?: string
}

export default function Leaderboard({ rows, groupBy }: LeaderboardProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('violations')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Sync sort key to group-by selection
  const groupSortMap: Record<string, SortKey> = {
    repo: 'repo',
    team: 'team',
    policy_domain: 'top_domain',
    week: 'violations',
  }
  useEffect(() => {
    if (groupBy && groupSortMap[groupBy]) {
      setSortKey(groupSortMap[groupBy])
      setSortDir('desc')
    }
  }, [groupBy])

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
                      <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
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
