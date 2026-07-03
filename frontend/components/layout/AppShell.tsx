'use client'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import LoginModal from './LoginModal'
import ShaderBackground from '@/components/shared/ShaderBackground'
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
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}
    >
      <ShaderBackground variant="app" />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar title={title} breadcrumb={breadcrumb} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {children}
        </main>
      </div>
      <LoginModal />
    </div>
  )
}
