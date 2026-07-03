'use client'
import { useEffect } from 'react'
import { useThemeStore } from '@/lib/store/theme'

export default function ThemeInit() {
  const init = useThemeStore((s) => s.init)
  useEffect(() => { init() }, [init])
  return null
}
