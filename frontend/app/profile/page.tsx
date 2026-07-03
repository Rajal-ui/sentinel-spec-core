'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/lib/store/auth'
import { useEffect, useState } from 'react'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { AxiosError } from 'axios'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfilePage() {
  const { user, isAuthenticated, updateProfile } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  })

  useEffect(() => {
    if (user) {
      reset({ name: user.name, username: user.email.split('@')[0] })
    }
  }, [user, reset])

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true)
    setSuccess(false)
    try {
      await updateProfile(data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>
      setError('root', {
        message: axiosErr?.response?.data?.message ?? 'Failed to update profile',
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
        Profile
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', marginBottom: 32 }}>
        Manage your account details
      </p>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            EMAIL
          </label>
          <input
            type="email"
            value={user?.email ?? ''}
            disabled
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '9px 12px',
              color: 'var(--text-muted)',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
              cursor: 'not-allowed',
            }}
          />
          <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Email cannot be changed
          </p>
        </div>

        <div>
          <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            FULL NAME
          </label>
          <input
            {...register('name')}
            type="text"
            placeholder="Alex Chen"
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: `1px solid ${errors.name ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 6,
              padding: '9px 12px',
              color: 'var(--text)',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
            }}
          />
          {errors.name && (
            <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            USERNAME
          </label>
          <input
            {...register('username')}
            type="text"
            placeholder="alexchen"
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: `1px solid ${errors.username ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 6,
              padding: '9px 12px',
              color: 'var(--text)',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
            }}
          />
          {errors.username && (
            <p className="font-mono-product" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
              {errors.username.message}
            </p>
          )}
        </div>

        <div>
          <label className="font-mono-product" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            ROLE
          </label>
          <input
            type="text"
            value={user?.role?.replace(/_/g, ' ') ?? ''}
            disabled
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '9px 12px',
              color: 'var(--text-muted)',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
              cursor: 'not-allowed',
              textTransform: 'capitalize',
            }}
          />
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
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {success && (
            <span className="font-mono-product" style={{ fontSize: 12, color: 'var(--primary)' }}>
              Profile updated successfully
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
