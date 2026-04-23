import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { isBlacklisted, blacklistToken } from '../../lib/token-blacklist.js'
import { decodeToken } from '../../lib/jwt.js'
import * as authService from '../../services/auth.service.js'
import { REFRESH_TOKEN_COOKIE } from '../../config/security.js'

const router = Router()

/**
 * POST /api/auth/refresh
 * Refresh access token. Reads refresh token from:
 *   1. httpOnly cookie (preferred)
 *   2. Request body (backward-compat)
 * Rotates both cookies on success.
 */
router.post(
  '/refresh',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    // Cookie-first, then body fallback
    const refreshToken: string | undefined =
      (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined) ?? req.body?.refreshToken

    if (!refreshToken) {
      sendError(res, 'Refresh token required', 'REFRESH_REQUIRED', 400)
      return
    }

    // Reject blacklisted refresh tokens
    if (isBlacklisted(refreshToken)) {
      sendError(res, 'Token has been revoked', 'TOKEN_REVOKED', 401)
      return
    }

    try {
      const tokens = await authService.refreshAccessToken(refreshToken)
      if (!tokens) {
        sendError(res, 'Account is inactive', 'ACCOUNT_INACTIVE', 401)
        return
      }

      // Blacklist the old refresh token to prevent replay
      const decoded = decodeToken(refreshToken)
      const ttl = decoded?.exp ? decoded.exp * 1000 - Date.now() : 7 * 24 * 60 * 60 * 1000
      if (ttl > 0) blacklistToken(refreshToken, ttl)

      // Rotate both cookies
      authService.setTokenCookies(res, tokens)

      res.set('Cache-Control', 'no-store')
      sendSuccess(res, {})
    } catch {
      sendError(res, 'Invalid or expired refresh token', 'REFRESH_FAILED', 401)
    }
  })
)

export default router
