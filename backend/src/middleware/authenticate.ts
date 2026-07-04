import type { Response, NextFunction } from 'express'
import { verifyAccessToken, verifyRefreshToken, rotateRefreshToken } from '../services/token.service.js'
import { prisma } from '../config/database.js'
import { UnauthorizedError } from '../utils/errors.js'
import { setAuthCookies } from '../utils/cookies.js'
import type { AuthenticatedRequest } from '../types/index.js'

/**
 * Primary authentication middleware.
 *
 * 1. Tries the access_token cookie (or Authorization header).
 * 2. If the access token is expired, tries the refresh_token cookie
 *    (scoped to /api/auth) and issues a new token pair.
 * 3. Attaches `req.user` (full User record) on success.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // ── Step 1: Extract token ─────────────────────────────────
    const accessToken =
      req.cookies?.access_token ??
      req.headers.authorization?.replace(/^Bearer\s+/i, '')

    if (accessToken) {
      try {
        const payload = verifyAccessToken(accessToken)
        const user = await prisma.user.findUnique({ where: { id: payload.sub } })
        if (!user) throw new UnauthorizedError('User not found')
        req.user = user
        return next()
      } catch (err) {
        // Access token invalid — fall through to refresh flow
        if (!(err instanceof UnauthorizedError)) throw err
      }
    }

    // ── Step 2: Refresh flow (cookie scoped to /api/auth) ─────
    const refreshToken = req.cookies?.refresh_token
    if (!refreshToken) {
      throw new UnauthorizedError('Authentication required')
    }

    const payload = verifyRefreshToken(refreshToken)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new UnauthorizedError('User not found')

    // Rotate tokens
    const tokens = await rotateRefreshToken(
      refreshToken,
      user.id,
      user.email,
      user.role,
    )
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken)

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Optional auth — attaches user if a valid token exists, but
 * does NOT reject the request when no token is present.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const accessToken = req.cookies?.access_token ?? req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (accessToken) {
      const payload = verifyAccessToken(accessToken)
      req.user = await prisma.user.findUnique({ where: { id: payload.sub } }) ?? undefined
    }
  } catch { /* noop */ }
  next()
}
