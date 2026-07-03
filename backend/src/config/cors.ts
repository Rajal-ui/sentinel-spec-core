import type { CorsOptions } from 'cors'
import { env } from './env.js'

export const corsOptions: CorsOptions = {
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}
