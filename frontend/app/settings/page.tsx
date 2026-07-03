'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/lib/store/auth'
import { useState } from 'react'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { AxiosError } from 'axios'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type PasswordFormData = z.infer<typeof passwordSchema>

export default function SettingsPage() {
  const { user, isAuthenticated, updatePassword } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmit = async (data: PasswordFormData) => {
    setSaving(true)
    setSuccess(false)
    try {
      await updatePassword(data.currentPassword, data.newPassword)
      setSuccess(true)
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>
      setError('root', {
        message: axiosErr?.response?.data?.message ?? 'Failed to update password',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>You must be signed in to view this page.</p>
        <Link href="/" style={{ color: 'var(--primary)' }}>Go home</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
      <Link
        href="/agent"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          fontSize: 13,
          fontFamily: 'Inter, sans-serif',
          marginBottom: 24,
        }}
      >
        <ArrowLeft size={14} />
        Back to workspace
      </Link>

      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        Settings
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', marginBottom: 32 }}>
        Update your password and security preferences
      </p>

      <div
        className="glass-raised"
        style={{
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Account
        </h2>
        <p className="font-mono-product" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          {user?.email} &middot; {user?.role?.replace(/_/g, ' ')}
        </p>

        <Link
          href="/profile"
          style={{
            color: 'var(--primary)',
            fontSize: 13,
            fontFamily: 'Inter, sans-serif',
            textDecoration: 'none',
          }}
        >
          Edit profile &rarr;
        </Link>
      </div>

      <div
        className="glass-raised"
        style={{
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          Change Password
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              CURRENT PASSWORD
            </label>
            <input
              {...register('currentPassword')}
              type="password"
              placeholder="Enter current password"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: `1px solid ${errors.currentPassword ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 6,
                padding: '9px 12px',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
              }}
            />
            {errors.currentPassword && (
              <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              NEW PASSWORD
            </label>
            <input
              {...register('newPassword')}
              type="password"
              placeholder="At least 8 characters"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: `1px solid ${errors.newPassword ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 6,
                padding: '9px 12px',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
              }}
            />
            {errors.newPassword && (
              <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              CONFIRM NEW PASSWORD
            </label>
            <input
              {...register('confirmPassword')}
              type="password"
              placeholder="Re-enter new password"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: `1px solid ${errors.confirmPassword ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 6,
                padding: '9px 12px',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
              }}
            />
            {errors.confirmPassword && (
              <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p className="font-mono-product" style={{ fontSize: 12, color: 'var(--danger)' }}>
              {errors.root.message}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 20px',
                fontSize: 14,
                fontFamily: 'Archivo, sans-serif',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Updating...' : 'Update Password'}
            </button>

            {success && (
              <span className="font-mono-product" style={{ fontSize: 12, color: 'var(--primary)' }}>
                Password updated successfully
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
