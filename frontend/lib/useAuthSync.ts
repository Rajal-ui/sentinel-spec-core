'use client'
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/store/auth'

/**
 * Synchronises the Zustand auth store with the backend on mount
 * and whenever the token changes.
 *
 * Always calls fetchProfile on first mount so that Google OAuth
 * redirects (which set cookies, not Zustand state) are detected.
 */
export function useAuthSync() {
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const initialized = useAuthStore((s) => s.initialized)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true

    if (token) {
      // Local login/register — token in store, verify with backend
      fetchProfile()
    } else {
      // Possible Google OAuth redirect — cookies may exist, test /user/me
      fetchProfile()
    }
  }, [token, fetchProfile])

  return initialized
}
