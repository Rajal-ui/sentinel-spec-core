import type { Response, NextFunction } from 'express'
import { z } from 'zod'
import * as authService from '../services/auth.service.js'
import * as tokenService from '../services/token.service.js'
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js'
import { toSnakeCase } from '../utils/snakecase.js'
import type { AuthenticatedRequest } from '../types/index.js'

// ── Validation schemas ────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  username: z
    .string()
    .min(3, 'Username must be 3–30 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

// ── POST /api/auth/register ───────────────────────────────────────────
export async function register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { user, tokens } = await authService.registerUser(req.body)
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
    res.status(201).json({ user: toSnakeCase(user), ...tokens })
  } catch (err) {
    next(err)
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────
export async function login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { user, tokens } = await authService.loginUser(req.body)
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
    res.json({ user: toSnakeCase(user), ...tokens })
  } catch (err) {
    next(err)
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────
export async function logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.user) {
      await tokenService.revokeAllUserTokens(req.user.id)
    }
    clearAuthCookies(res)
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    next(err)
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────────────
export async function refresh(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const oldRefresh = req.cookies?.refresh_token
    if (!oldRefresh) {
      res.status(401).json({ error: { message: 'Refresh token required', statusCode: 401 } })
      return
    }

    const payload = tokenService.verifyRefreshToken(oldRefresh)
    const tokens = await tokenService.rotateRefreshToken(
      oldRefresh,
      payload.sub,
      payload.email,
      payload.role,
    )

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
    res.json({ ...tokens })
  } catch (err) {
    next(err)
  }
}

// ── GET /api/auth/google ──────────────────────────────────────────────
// This route is handled entirely by passport — see auth.routes.ts.
// The controller below is used as the callback handler.

export function googleCallback(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.redirect(`${process.env.CLIENT_URL}/?login=failed`)
    return
  }

  // Issue tokens for the OAuth-linked user
  tokenService
    .issueTokenPair(req.user.id, req.user.email, req.user.role)
    .then((tokens) => {
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
      res.redirect(process.env.CLIENT_URL ?? 'http://localhost:3000')
    })
    .catch(() => {
      res.redirect(`${process.env.CLIENT_URL ?? 'http://localhost:3000'}/?login=failed`)
    })
}
