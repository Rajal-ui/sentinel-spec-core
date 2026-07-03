import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import { env } from './config/env.js'
import { corsOptions } from './config/cors.js'
import { errorHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/user.routes.js'

import './config/passport.js'

const app = express()

// ── Security headers ──────────────────────────────────────────────────
app.use(helmet())

// ── CORS ──────────────────────────────────────────────────────────────
app.use(cors(corsOptions))

// ── Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }))
app.use(cookieParser())

// ── Passport ──────────────────────────────────────────────────────────
app.use(passport.initialize())

// ── Routes ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)

// ── Error handler (must be last) ──────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`[auth] server running on http://localhost:${env.PORT}`)
})

export default app
