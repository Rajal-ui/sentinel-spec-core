import type { Request } from 'express'
import type { User } from '@prisma/client'

export interface AuthPayload {
  sub: string       // user.id
  email: string
  role: string
}

export interface AuthenticatedRequest extends Request {
  user?: User
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
