import type { Profile } from 'passport-google-oauth20'
import { prisma } from '../config/database.js'
import { ConflictError } from '../utils/errors.js'

/**
 * Google OAuth callback handler.
 *
 * Strategy:
 *   1. Look up user by googleId.
 *   2. If not found, look up by email (link existing account).
 *   3. If still not found, create a new user.
 */
export async function handleGoogleLogin(profile: Profile) {
  const googleId = profile.id
  const email = profile.emails?.[0]?.value?.toLowerCase().trim()
  const name = profile.displayName
  const avatarUrl = profile.photos?.[0]?.value ?? null

  if (!email) {
    throw new Error('Google account has no email address')
  }

  // 1 — Existing Google-linked account
  const existingByGoogle = await prisma.user.findUnique({ where: { googleId } })
  if (existingByGoogle) return existingByGoogle

  // 2 — Existing email account (link)
  const existingByEmail = await prisma.user.findUnique({ where: { email } })
  if (existingByEmail) {
    // Only link if the account has no password (OAuth-only) or if googleId not set yet
    if (!existingByEmail.googleId) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId, googleEmail: email, avatarUrl },
      })
    }
    // googleId belongs to a different Google account — conflict
    throw new ConflictError('This email is already linked to another Google account')
  }

  // 3 — New user via OAuth
  const username = email.split('@')[0]
  const baseUsername = username

  // Ensure unique username
  let finalUsername = username
  let suffix = 1
  while (await prisma.user.findUnique({ where: { username: finalUsername } })) {
    finalUsername = `${baseUsername}${suffix}`
    suffix++
  }

  return prisma.user.create({
    data: {
      name,
      email,
      username: finalUsername,
      googleId,
      googleEmail: email,
      avatarUrl,
      passwordHash: null, // OAuth users have no password
    },
  })
}
