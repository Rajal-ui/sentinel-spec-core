import bcrypt from 'bcryptjs'
import { prisma } from '../config/database.js'
import type { RegisterInput, LoginInput } from '../types/index.js'
import { ConflictError, UnauthorizedError } from '../utils/errors.js'
import { issueTokenPair } from './token.service.js'

const BCRYPT_ROUNDS = 12

// ── Registration ──────────────────────────────────────────────────────
export async function registerUser(input: RegisterInput) {
  const { name, email, username, password } = input

  // Normalise
  const normalizedEmail = email.toLowerCase().trim()
  const normalizedUsername = username.toLowerCase().trim()

  // Check duplicates
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedEmail },
        { username: normalizedUsername },
      ],
    },
  })

  if (existing) {
    const field = existing.email === normalizedEmail ? 'email' : 'username'
    throw new ConflictError(`A user with this ${field} already exists`)
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
    },
  })

  const tokens = await issueTokenPair(user.id, user.email, user.role)

  return {
    user: sanitizeUser(user),
    tokens,
  }
}

// ── Login ─────────────────────────────────────────────────────────────
export async function loginUser(input: LoginInput) {
  const { email, password } = input
  const normalizedEmail = email.toLowerCase().trim()

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const tokens = await issueTokenPair(user.id, user.email, user.role)

  return {
    user: sanitizeUser(user),
    tokens,
  }
}

// ── Strip sensitive fields ────────────────────────────────────────────
function sanitizeUser(user: {
  id: string
  name: string
  email: string
  username: string
  role: string
  avatarUrl: string | null
  googleId: string | null
  createdAt: Date
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    avatarUrl: user.avatarUrl,
    googleId: user.googleId,
    createdAt: user.createdAt.toISOString(),
  }
}
