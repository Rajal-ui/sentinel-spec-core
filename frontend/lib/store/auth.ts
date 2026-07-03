'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, LoginCredentials, RegisterCredentials } from '@/lib/types'
import api from '@/lib/api'

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
      token: null,
      isAuthenticated: false,
      showLoginModal: false,
      loginRedirect: null,
      initialized: false,

      login: async (credentials) => {
        const { data } = await api.post('/auth/login', credentials)
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          showLoginModal: false,
          loginRedirect: null,
        })
        document.cookie = `sentinel-auth=${data.token}; path=/; max-age=604800`
        const redirect = get().loginRedirect ?? '/dashboard'
        window.location.href = redirect
      },

      register: async (credentials) => {
        const { data } = await api.post('/auth/register', credentials)
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          showLoginModal: false,
          loginRedirect: null,
        })
        document.cookie = `sentinel-auth=${data.token}; path=/; max-age=604800`
        window.location.href = '/dashboard'
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch {
          // proceed with client-side cleanup even if server call fails
        }
        set({ user: null, token: null, isAuthenticated: false })
        document.cookie = 'sentinel-auth=; path=/; max-age=0'
        window.location.href = '/'
      },

      fetchProfile: async () => {
        try {
          const { data } = await api.get('/user/me')
          set({ user: data.user, isAuthenticated: true, initialized: true })
        } catch {
          set({ user: null, token: null, isAuthenticated: false, initialized: true })
          document.cookie = 'sentinel-auth=; path=/; max-age=0'
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
    }
  )
)
