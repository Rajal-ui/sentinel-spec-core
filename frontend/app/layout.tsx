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
          __html: `(function(){try{var t=localStorage.getItem('sentinel-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);document.documentElement.className=t}}catch(e){}})()`
        }} />
      </head>
      <body className="min-h-screen relative antialiased transition-colors duration-300 bg-[#FAF8F6] text-[#09090B] bg-[radial-gradient(at_top_right,_var(--tw-gradient-stops))] from-[#FFEDD5]/30 via-[#FAF8F6] to-[#CCFBF1]/20 dark:bg-[#08080A] dark:text-[#E8EAED] dark:bg-[radial-gradient(at_top_right,_var(--tw-gradient-stops))] dark:from-[#FF7A59]/5 dark:via-[#08080A] dark:to-[#5FD9C6]/5">
        <div className="relative z-10 w-full min-h-screen flex flex-col">
          <ThemeInit />
          <AuthSyncProvider>
            {children}
          </AuthSyncProvider>
        </div>
      </body>
    </html>
  )
}
