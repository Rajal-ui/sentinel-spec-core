'use client'
import type { ReactNode } from 'react'
import { useAuthSync } from '@/lib/useAuthSync'

export default function AuthSyncProvider({ children }: { children: ReactNode }) {
  useAuthSync()
  return <>{children}</>
}
