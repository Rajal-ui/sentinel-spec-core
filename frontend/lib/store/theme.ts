'use client'
import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  init: () => void
}

const STORAGE_KEY = 'sentinel-theme'

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.className = t
  try { localStorage.setItem(STORAGE_KEY, t) } catch {}
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: 'dark',
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    return { theme: next }
  }),
  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
  },
  init: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (stored === 'light' || stored === 'dark') {
        applyTheme(stored)
        set({ theme: stored })
      } else {
        applyTheme('dark')
      }
    } catch {
      applyTheme('dark')
    }
  },
}))
