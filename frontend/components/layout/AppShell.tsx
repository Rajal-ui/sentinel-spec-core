'use client'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import LoginModal from './LoginModal'

import { useThemeStore } from '@/lib/store/theme'

interface Props {
  children: React.ReactNode
  title: string
  breadcrumb?: string
}

export default function AppShell({ children, title, breadcrumb }: Props) {
  const theme = useThemeStore((s) => s.theme)

  return (
    <div
      data-theme={theme}
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'transparent' }}
    >
      {/* Sidebar with micro-border separation */}
      <div className="border-r border-slate-200/60 dark:border-[#1F2029]/70">
        <Sidebar />
      </div>
      {/* Content area — transparent so body gradient shows through */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-transparent">
        <TopBar title={title} breadcrumb={breadcrumb} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      <LoginModal />
    </div>
  )
}
