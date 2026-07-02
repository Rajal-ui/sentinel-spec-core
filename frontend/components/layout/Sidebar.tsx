'use client'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  MessageSquare, Shield, BarChart3, BookOpen, Package, FileText,
  Settings2, LifeBuoy, ChevronLeft, ChevronRight, Sun, Moon,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth'

const NAV_ITEMS = [
  { label: 'Dashboard', icon: BarChart3, href: '/dashboard' },
  { label: 'Agent Workspace', icon: MessageSquare, href: '/agent' },
  { label: 'Audit Console', icon: Shield, href: '/audit' },
  { label: 'Analytics', icon: BookOpen, href: '/analytics' },
  { label: 'Export / IDE Skill', icon: Package, href: '/export' },
  { label: 'Documentation', icon: FileText, href: '/docs' },
]

const BOTTOM_ITEMS = [
  { label: 'Settings', icon: Settings2, href: '/settings' },
  { label: 'Support', icon: LifeBuoy, href: '/support' },
]

interface Props { theme: 'light' | 'dark'; onThemeToggle: () => void }

export default function Sidebar({ theme, onThemeToggle }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const prefersReducedMotion = useReducedMotion()

  const container = {
    show: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.04 } },
  }
  const item = {
    hidden: prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 },
    show: { opacity: 1, x: 0, transition: { duration: 0.2 } },
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        height: '100vh',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
        background: 'var(--surface-muted)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Shield size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Sentinel Spec
                </div>
                <div className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                  ibm-bob-workspace
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4,
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav items */}
      <motion.nav
        variants={container}
        initial="hidden"
        animate="show"
        style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
      >
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname.startsWith(href)
          return (
            <motion.div key={href} variants={item}>
              <Link
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '10px 0' : '10px 16px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
                  background: active ? 'rgba(27,108,168,0.10)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)'
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.12 }}
                      style={{
                        fontSize: 14,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: active ? 500 : 400,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          )
        })}
      </motion.nav>

      {/* Bottom section */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
        {BOTTOM_ITEMS.map(({ label, icon: Icon, href }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '8px 0' : '8px 16px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              textDecoration: 'none',
              color: 'var(--text-muted)',
              fontSize: 14,
              transition: 'color 0.15s',
            }}
          >
            <Icon size={15} style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.12 }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        ))}

        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '8px 0' : '8px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.12 }}
                style={{ overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}
              >
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User */}
        {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: collapsed ? '10px 0' : '10px 16px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderTop: '1px solid var(--border)',
              marginTop: 4,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
                fontFamily: 'Archivo, sans-serif',
              }}
            >
              {user.name.charAt(0)}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.12 }}
                  style={{ overflow: 'hidden', minWidth: 0 }}
                >
                  <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                    {user.name}
                  </div>
                  <div className="font-mono-product" style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {user.role}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.aside>
  )
}
