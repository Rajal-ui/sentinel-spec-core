import type { CorsOptions } from 'cors'
import { env } from './env.js'

const allowedOrigins = [
  process.env.FRONTEND_URL,
  env.CLIENT_URL,                                          // primary (set in .env / Railway)
  'http://localhost:3000',
  'http://localhost:3001',
  'https://sentinel-spec-core.vercel.app',
].filter(Boolean) as string[]

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin '${origin}' not allowed`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
}
