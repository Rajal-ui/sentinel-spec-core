'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, LoginCredentials, RegisterCredentials } from '@/lib/types'
import api from '@/lib/api'

const COOKIE_NAME = 'sentinel-auth'

function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function resolveInitialToken(): string | null {
  // 1. Check the sentinel-auth cookie first (set by TokenHandler after OAuth)
  const fromCookie = getTokenFromCookie()
  if (fromCookie) return fromCookie

  // 2. Fall back to the raw localStorage token key (also written by TokenHandler)
  try {
    const raw = localStorage.getItem('token')
    if (raw) return raw
  } catch {}

  // 3. Fall back to Zustand's persisted state (from a previous session)
  try {
    const stored = localStorage.getItem('sentinel-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.state?.token) return parsed.state.token
    }
  } catch {}

  return null
}

const initialToken = resolveInitialToken()

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  showLoginModal: boolean
  loginRedirect: string | null
  initialized: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  logout: () => Promise<void>
  openLoginModal: (redirect?: string) => void
  closeLoginModal: () => void
  fetchProfile: () => Promise<void>
  updateProfile: (data: Partial<Pick<User, 'name' | 'avatar_url'>> & { username?: string }) => Promise<User>
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: initialToken,
      isAuthenticated: !!initialToken,
      showLoginModal: false,
      loginRedirect: null,
      initialized: false,

      login: async (credentials) => {
        const { data } = await api.post('/auth/login', credentials)
        const redirect = get().loginRedirect ?? '/agent'
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          showLoginModal: false,
          loginRedirect: null,
        })
        document.cookie = `${COOKIE_NAME}=${data.token}; path=/; max-age=604800; Secure; SameSite=Lax`
        window.location.href = redirect
      },

      register: async (credentials) => {
        const { data } = await api.post('/auth/register', credentials)
        const redirect = get().loginRedirect ?? '/agent'
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          showLoginModal: false,
          loginRedirect: null,
        })
        document.cookie = `${COOKIE_NAME}=${data.token}; path=/; max-age=604800; Secure; SameSite=Lax`
        window.location.href = redirect
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch {
          // proceed with client-side cleanup even if server call fails
        }
        set({ user: null, token: null, isAuthenticated: false })
        document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
        window.location.href = '/'
      },

      fetchProfile: async () => {
        try {
          const { data } = await api.get('/user/me')
          set({ user: data.user, isAuthenticated: true, initialized: true })
          const token = get().token
          if (token) {
            document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=900; Secure; SameSite=Lax`
          }
        } catch {
          set({ user: null, token: null, isAuthenticated: false, initialized: true })
          document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
        }
      },

      updateProfile: async (profileData) => {
        const { data } = await api.patch('/user/profile', profileData)
        set({ user: data.user })
        return data.user
      },

      updatePassword: async (currentPassword, newPassword) => {
        await api.patch('/user/password', { currentPassword, newPassword })
      },

      openLoginModal: (redirect) =>
        set({ showLoginModal: true, loginRedirect: redirect ?? null }),

      closeLoginModal: () =>
        set({ showLoginModal: false, loginRedirect: null }),
    }),
    {
      name: 'sentinel-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted ?? {}) }
        // The sentinel-auth cookie is the single source of truth on every pageload.
        // If a valid cookie exists, it must override any stale persisted state
        // (e.g. isAuthenticated: false from a prior logout or missing persist key).
        const cookieToken = getTokenFromCookie()
        if (cookieToken) {
          merged.token = cookieToken
          merged.isAuthenticated = true
        }
        return merged
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const cookieToken = getTokenFromCookie()
        if (cookieToken && !state.token) {
          useAuthStore.setState({ token: cookieToken, isAuthenticated: true })
        }
      },
    }
  )
)
