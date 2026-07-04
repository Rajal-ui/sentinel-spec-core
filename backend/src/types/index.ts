// Augment the global Express.User interface so req.user carries the full
// Prisma User shape on every Request — no custom wrapper interface needed.
// This file is transitively imported by all route handlers via the controllers.

import type { User as PrismaUser } from '@prisma/client'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Merging PrismaUser into Express.User makes req.user typed as the full
    // Prisma User on every Request without a custom AuthenticatedRequest wrapper.
    interface User extends PrismaUser {}
  }
}

export interface AuthPayload {
  sub: string       // user.id
  email: string
  role: string
}

export interface RegisterInput {
  name: string
  email: string
  username: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}
