import { Router } from 'express'
import passport from 'passport'
import rateLimit from 'express-rate-limit'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/authenticate.js'
import * as authController from '../controllers/auth.controller.js'

const router = Router()

// Rate-limit auth endpoints aggressively
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max: 20,                     // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later', statusCode: 429 } },
})

// ── Public ────────────────────────────────────────────────────────────
router.post('/register', authLimiter, validate(authController.registerSchema), authController.register)
router.post('/login', authLimiter, validate(authController.loginSchema), authController.login)
router.post('/refresh', authLimiter, authController.refresh)

// ── Google OAuth ──────────────────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
)

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failWithError: true }),
  authController.googleCallback,
  (_err: Error, _req: any, res: any, _next: any) => {
    res.redirect(`${process.env.CLIENT_URL ?? 'http://localhost:3000'}/?login=failed`)
  },
)

// ── Protected ─────────────────────────────────────────────────────────
router.post('/logout', authenticate, authController.logout)

export default router
