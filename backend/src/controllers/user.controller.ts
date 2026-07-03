import type { Response, NextFunction } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/database.js'
import { NotFoundError, ConflictError, UnauthorizedError, ValidationError } from '../utils/errors.js'
import { toSnakeCase } from '../utils/snakecase.js'
import type { AuthenticatedRequest } from '../types/index.js'

// ── Validation ────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  username: z
    .string()
    .min(3, 'Username must be 3–30 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only')
    .optional(),
  avatar_url: z.string().url().nullable().optional(),
})

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

// ── GET /api/user/me ──────────────────────────────────────────────────
export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!
    res.json({ user: toSnakeCase(sanitize(user)) })
  } catch (err) {
    next(err)
  }
}

// ── PATCH /api/user/profile ───────────────────────────────────────────
export async function updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const { name, username, avatar_url } = req.body

    if (username) {
      const normalized = username.toLowerCase().trim()
      const existing = await prisma.user.findFirst({
        where: { username: normalized, id: { not: userId } },
      })
      if (existing) {
        throw new ConflictError('Username already taken')
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(username !== undefined && { username: username.toLowerCase().trim() }),
        ...(avatar_url !== undefined && { avatarUrl: avatar_url }),
      },
    })

    res.json({ user: toSnakeCase(sanitize(updated)) })
  } catch (err) {
    next(err)
  }
}

// ── PATCH /api/user/password ──────────────────────────────────────────
export async function updatePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    })

    if (!user) throw new NotFoundError('User')
    if (!user.passwordHash) {
      throw new ValidationError('OAuth accounts cannot change password via email login')
    }

    const { currentPassword, newPassword } = req.body
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedError('Current password is incorrect')
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    next(err)
  }
}

function sanitize(u: {
  id: string; name: string; email: string; username: string
  role: string; avatarUrl: string | null; googleId: string | null; createdAt: Date
}) {
  return {
    id: u.id, name: u.name, email: u.email, username: u.username,
    role: u.role, avatarUrl: u.avatarUrl, googleId: u.googleId,
    createdAt: u.createdAt.toISOString(),
  }
}
