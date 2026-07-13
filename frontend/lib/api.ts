'use client'
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    let token: string | null = null

    // 1. Try raw token from localStorage
    try {
      token = localStorage.getItem('token')
    } catch {}

    // 2. Try sentinel-auth cookie
    if (!token) {
      try {
        const match = document.cookie.match(/(?:^|;\s*)sentinel-auth=([^;]*)/)
        if (match) token = decodeURIComponent(match[1])
      } catch {}
    }

    // 3. Fall back to Zustand's persisted store in localStorage
    if (!token) {
      try {
        const stored = localStorage.getItem('sentinel-auth')
        if (stored) {
          const parsed = JSON.parse(stored)
          token = parsed?.state?.token
        }
      } catch {}
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('sentinel-auth')
    }
    return Promise.reject(err)
  }
)

export default api
