import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { env } from './env.js'
import * as oauthService from '../services/oauth.service.js'

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await oauthService.handleGoogleLogin(profile)
        done(null, user)
      } catch (err) {
        done(err as Error)
      }
    },
  ),
)
