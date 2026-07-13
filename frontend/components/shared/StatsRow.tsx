'use client'
import { motion } from 'framer-motion'

export interface StatItem {
  label: string
  value: string
  sub: string
}

interface StatsRowProps {
  items: StatItem[]
}

export default function StatsRow({ items }: StatsRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
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
          style={{ borderRadius: 8, padding: '14px 16px', borderBottom: '2px solid rgba(255,255,255,0.05)' }}
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
