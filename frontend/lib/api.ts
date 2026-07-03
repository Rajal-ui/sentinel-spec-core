'use client'
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sentinel-auth')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const token = parsed?.state?.token
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch {}
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
