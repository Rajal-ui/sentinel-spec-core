import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import type { AuthPayload, TokenPair } from '../types/index.js'
import { UnauthorizedError } from '../utils/errors.js'

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  })
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  })
}

export function verifyAccessToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload
  } catch {
    throw new UnauthorizedError('Access token invalid or expired')
  }
}

export function verifyRefreshToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthPayload
  } catch {
    throw new UnauthorizedError('Refresh token invalid or expired')
  }
}

// ── Issue a full token pair and persist the refresh token ───
export async function issueTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
  const payload: AuthPayload = { sub: userId, email, role }

  const accessToken = signAccessToken(payload)
  const rawRefreshToken = signRefreshToken(payload)

  // Hash the refresh token before storing (defense-in-depth)
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')

  // Store hash in DB with 7-day TTL
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return { accessToken, refreshToken: rawRefreshToken }
}

// ── Rotate refresh token (old one consumed, new one issued) ──
export async function rotateRefreshToken(
  oldRawToken: string,
  userId: string,
  email: string,
  role: string,
): Promise<TokenPair> {
  const oldHash = crypto.createHash('sha256').update(oldRawToken).digest('hex')

  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: oldHash, userId },
  })

  if (!stored) {
    // Token reuse detected — revoke all tokens for this user
    await prisma.refreshToken.deleteMany({ where: { userId } })
    throw new UnauthorizedError('Refresh token has been revoked — re-authentication required')
  }

  // Consume the old token
  await prisma.refreshToken.delete({ where: { id: stored.id } })

  // Issue a new pair
  return issueTokenPair(userId, email, role)
}

// ── Revoke all refresh tokens for a user (logout everywhere) ──
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } })
}
