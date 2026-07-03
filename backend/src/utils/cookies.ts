import type { Response } from 'express'

const isProduction = () => process.env.NODE_ENV === 'production'

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'strict' : 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,               // 15 min
  })

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,      // 7 days
  })

  // Match the cookie the frontend middleware checks
  res.cookie('sentinel-auth', accessToken, {
    httpOnly: false,                        // readable by JS for middleware
    secure: isProduction(),
    sameSite: isProduction() ? 'strict' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,       // 7 days
  })
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/api/auth' })
  res.clearCookie('sentinel-auth', { path: '/' })
}
