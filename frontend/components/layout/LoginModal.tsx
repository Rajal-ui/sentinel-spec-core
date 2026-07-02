'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { X, GitBranch } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/lib/store/auth'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginModal() {
  const { showLoginModal, closeLoginModal, login, loginOAuth } = useAuthStore()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'github' | 'google' | null>(null)

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await login(data)
    } catch {
      setError('root', { message: 'Invalid credentials. Try any email + 8+ char password.' })
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'github' | 'google') => {
    setOauthLoading(provider)
    await loginOAuth(provider)
    setOauthLoading(null)
  }

  return (
    <AnimatePresence>
      {showLoginModal && (
        <>
          {/* Backdrop */}
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

          {/* Modal — centred via margin auto inside a flex overlay to avoid transform conflicts */}
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

            {/* Mode toggle */}
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

            {/* OAuth */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => handleOAuth('github')}
                disabled={!!oauthLoading}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 0',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  opacity: oauthLoading ? 0.6 : 1,
                }}
              >
                <GitBranch size={15} />
                {oauthLoading === 'github' ? 'Connecting...' : 'GitHub'}
              </button>
              <button
                onClick={() => handleOAuth('google')}
                disabled={!!oauthLoading}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 0',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  opacity: oauthLoading ? 0.6 : 1,
                }}
              >
                {/* Google G icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {oauthLoading === 'google' ? 'Connecting...' : 'Google'}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ marginBottom: 14 }}>
                <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  EMAIL
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@company.com"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: `1px solid ${errors.email ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: 6,
                    padding: '9px 12px',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                  }}
                />
                {errors.email && (
                  <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  PASSWORD
                </label>
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: `1px solid ${errors.password ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: 6,
                    padding: '9px 12px',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                  }}
                />
                {errors.password && (
                  <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {errors.root && (
                <p className="font-mono-product" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>
                  {errors.root.message}
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
                {loading ? (mode === 'signin' ? 'Signing in...' : 'Creating account...') : (mode === 'signin' ? 'Sign In' : 'Create Account')}
              </button>
            </form>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
