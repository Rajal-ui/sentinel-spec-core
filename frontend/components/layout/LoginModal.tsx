'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/lib/store/auth'
import { useState } from 'react'
import type { AxiosError } from 'axios'

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const signUpSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type SignInData = z.infer<typeof signInSchema>
type SignUpData = z.infer<typeof signUpSchema>

export default function LoginModal() {
  const { showLoginModal, closeLoginModal, login, register: registerUser } = useAuthStore()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)

  const signInForm = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
  })

  const signUpForm = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
  })

  const onSignIn = async (data: SignInData) => {
    setLoading(true)
    try {
      await login(data)
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>
      signInForm.setError('root', {
        message: axiosErr?.response?.data?.message ?? 'Invalid credentials',
      })
    } finally {
      setLoading(false)
    }
  }

  const onSignUp = async (data: SignUpData) => {
    setLoading(true)
    try {
      await registerUser(data)
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>
      signUpForm.setError('root', {
        message: axiosErr?.response?.data?.message ?? 'Registration failed. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {showLoginModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLoginModal}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(8,8,10,0.7)',
              backdropFilter: 'blur(6px)',
            }}
          />

          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 201,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="glass-raised"
            style={{
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 201,
              width: 400,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 12,
              padding: 32,
            }}
          >
            <button
              onClick={closeLoginModal}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', marginBottom: 24, background: 'var(--surface)', borderRadius: 8, padding: 4, gap: 4 }}>
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Archivo, sans-serif',
                    fontWeight: 700,
                    fontSize: 13,
                    background: mode === m ? 'var(--primary)' : 'transparent',
                    color: mode === m ? '#fff' : 'var(--text-muted)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                {mode === 'signin' ? 'Sign in to Sentinel Spec' : 'Create your account'}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                {mode === 'signin' ? 'Access your audit workspace and analysis history.' : 'Start catching violations before the PR exists.'}
              </p>
            </div>

            {mode === 'signin' ? (
              <><form onSubmit={signInForm.handleSubmit(onSignIn)}>
                <div style={{ marginBottom: 14 }}>
                  <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    EMAIL
                  </label>
                  <input
                    {...signInForm.register('email')}
                    type="email"
                    placeholder="you@company.com"
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: `1px solid ${signInForm.formState.errors.email ? 'var(--danger)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '9px 12px',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                    }}
                  />
                  {signInForm.formState.errors.email && (
                    <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                      {signInForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    PASSWORD
                  </label>
                  <input
                    {...signInForm.register('password')}
                    type="password"
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: `1px solid ${signInForm.formState.errors.password ? 'var(--danger)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '9px 12px',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                    }}
                  />
                  {signInForm.formState.errors.password && (
                    <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                      {signInForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {signInForm.formState.errors.root && (
                  <p className="font-mono-product" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>
                    {signInForm.formState.errors.root.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '11px 0',
                    fontSize: 14,
                    fontFamily: 'Archivo, sans-serif',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    letterSpacing: '0.02em',
                  }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 0 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <a
                href={`${process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/google`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '9px 0',
                  marginTop: 16,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  textDecoration: 'none',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </a>
            </>) : (
              <><form onSubmit={signUpForm.handleSubmit(onSignUp)}>
                <div style={{ marginBottom: 14 }}>
                  <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    FULL NAME
                  </label>
                  <input
                    {...signUpForm.register('name')}
                    type="text"
                    placeholder="Alex Chen"
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: `1px solid ${signUpForm.formState.errors.name ? 'var(--danger)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '9px 12px',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                    }}
                  />
                  {signUpForm.formState.errors.name && (
                    <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                      {signUpForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    USERNAME
                  </label>
                  <input
                    {...signUpForm.register('username')}
                    type="text"
                    placeholder="alexchen"
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: `1px solid ${signUpForm.formState.errors.username ? 'var(--danger)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '9px 12px',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                    }}
                  />
                  {signUpForm.formState.errors.username && (
                    <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                      {signUpForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    EMAIL
                  </label>
                  <input
                    {...signUpForm.register('email')}
                    type="email"
                    placeholder="you@company.com"
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: `1px solid ${signUpForm.formState.errors.email ? 'var(--danger)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '9px 12px',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                    }}
                  />
                  {signUpForm.formState.errors.email && (
                    <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                      {signUpForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    PASSWORD
                  </label>
                  <input
                    {...signUpForm.register('password')}
                    type="password"
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: `1px solid ${signUpForm.formState.errors.password ? 'var(--danger)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '9px 12px',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                    }}
                  />
                  {signUpForm.formState.errors.password && (
                    <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                      {signUpForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {signUpForm.formState.errors.root && (
                  <p className="font-mono-product" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>
                    {signUpForm.formState.errors.root.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '11px 0',
                    fontSize: 14,
                    fontFamily: 'Archivo, sans-serif',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    letterSpacing: '0.02em',
                  }}
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 0 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <a
                href={`${process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/google`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '9px 0',
                  marginTop: 16,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  textDecoration: 'none',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign up with Google
              </a>
            </>)}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
