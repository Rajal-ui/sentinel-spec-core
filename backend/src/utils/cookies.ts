import type { Response } from 'express'

const isProduction = () => process.env.NODE_ENV === 'production'

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  // Cross-origin (Vercel → Railway): SameSite=none + Secure required.
  // Local dev: SameSite=lax is fine (same-site localhost).
  const sameSite = isProduction() ? 'none' : 'lax'
  const secure   = isProduction()

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 15 * 60 * 1000,               // 15 min
  })

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',                            // Must be '/' so browser sends on any /api/* path
    maxAge: 7 * 24 * 60 * 60 * 1000,      // 7 days
  })

  // Readable by Next.js proxy middleware for route protection
  res.cookie('sentinel-auth', accessToken, {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,       // 7 days
  })
}

export function clearAuthCookies(res: Response) {
  const isProduction = process.env.NODE_ENV === 'production'
  const opts = { path: '/', secure: isProduction, sameSite: isProduction ? 'none' : 'lax' } as const
  res.clearCookie('access_token',  opts)
  res.clearCookie('refresh_token', opts)
  res.clearCookie('sentinel-auth', opts)
}
