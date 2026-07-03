import type { Metadata } from 'next'
import './globals.css'
import AuthSyncProvider from '@/components/AuthSyncProvider'

export const metadata: Metadata = {
  title: 'Sentinel Spec — Autonomous Architecture Compliance',
  description: 'Stop violations before the PR exists. Autonomous architecture and compliance reviewer inside IBM Bob IDE.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthSyncProvider>
          {children}
        </AuthSyncProvider>
      </body>
    </html>
  )
}
