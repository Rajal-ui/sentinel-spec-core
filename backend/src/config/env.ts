import 'dotenv/config'

function required(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export const env = {
  PORT:           Number(optional('PORT', '4000')),
  NODE_ENV:       optional('NODE_ENV', 'development'),
  DATABASE_URL:   required('DATABASE_URL'),

  JWT_ACCESS_SECRET:       required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET:      required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN:   optional('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN:  optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  GOOGLE_CLIENT_ID:       required('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET:   required('GOOGLE_CLIENT_SECRET'),
  GOOGLE_CALLBACK_URL:    required('GOOGLE_CALLBACK_URL'),

  CLIENT_URL:   required('CLIENT_URL'),
} as const
