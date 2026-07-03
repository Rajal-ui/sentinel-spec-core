import type { Metadata } from 'next'
import './globals.css'
import AuthSyncProvider from '@/components/AuthSyncProvider'
import ThemeInit from '@/components/ThemeInit'

export const metadata: Metadata = {
  title: 'Sentinel Spec — Autonomous Architecture Compliance',
  description: 'Stop violations before the PR exists. Autonomous architecture and compliance reviewer inside IBM Bob IDE.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('sentinel-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`
        }} />
      </head>
      <body>
        <ThemeInit />
        <AuthSyncProvider>
          {children}
        </AuthSyncProvider>
      </body>
    </html>
  )
}
