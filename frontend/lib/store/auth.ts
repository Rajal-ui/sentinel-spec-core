'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, LoginCredentials } from '@/lib/types'

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  showLoginModal: boolean
  loginRedirect: string | null
  login: (credentials: LoginCredentials) => Promise<void>
  loginOAuth: (provider: 'github' | 'google') => Promise<void>
  logout: () => void
  openLoginModal: (redirect?: string) => void
  closeLoginModal: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      showLoginModal: false,
      loginRedirect: null,

      login: async (credentials) => {
        // Stub: replace with real API call
        await new Promise((r) => setTimeout(r, 800))
        const mockUser: User = {
          id: 'u-1',
          name: 'Alex Chen',
          email: credentials.email,
          role: 'engineering_manager',
          avatar_url: null,
        }
        const redirect = get().loginRedirect ?? '/dashboard'
        set({ user: mockUser, isAuthenticated: true, showLoginModal: false, loginRedirect: null })
        // Set auth cookie for middleware
        document.cookie = 'sentinel-auth=mock-jwt-token; path=/; max-age=86400'
        window.location.href = redirect
      },

      loginOAuth: async (provider) => {
        await new Promise((r) => setTimeout(r, 600))
        const mockUser: User = {
          id: 'u-oauth-1',
          name: provider === 'github' ? 'GitHub User' : 'Google User',
          email: `user@${provider}.com`,
          role: 'developer',
          avatar_url: null,
        }
        const redirect = get().loginRedirect ?? '/dashboard'
        set({ user: mockUser, isAuthenticated: true, showLoginModal: false, loginRedirect: null })
        document.cookie = 'sentinel-auth=mock-jwt-token; path=/; max-age=86400'
        window.location.href = redirect
      },

      logout: () => {
        set({ user: null, isAuthenticated: false })
        document.cookie = 'sentinel-auth=; path=/; max-age=0'
        window.location.href = '/'
      },

      openLoginModal: (redirect) =>
        set({ showLoginModal: true, loginRedirect: redirect ?? null }),

      closeLoginModal: () =>
        set({ showLoginModal: false, loginRedirect: null }),
    }),
    {
      name: 'sentinel-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
