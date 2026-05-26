import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import * as authService from '../../services/auth.service.js'
import { RefreshReuseError } from '../../services/auth/login.js'
import { REFRESH_TOKEN_COOKIE, ALLOWED_ORIGINS } from '../../config/security.js'

const router = Router()

/**
 * POST /api/auth/refresh
 * Family-rotation refresh (RFC 6819 §5.2.2.3). Reads refresh token from:
 *   1. httpOnly cookie (preferred)
 *   2. Request body (backward-compat)
 *
 * All rotation failures collapse to a generic 401 so the client can't tell
 * the difference between "unknown token", "reuse detected", or "user inactive".
 */
router.post(
  '/refresh',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    // P1.1 — Origin allowlist gate. Refresh is CSRF-exempt (FE refresh queue
    // can't carry the token), so we instead reject cross-origin POSTs to stop
    // any malicious site from rotating a logged-in user's session.
    const origin = req.get('origin') ?? req.get('referer')
    if (origin && !ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
      sendError(res, 'Origin not allowed', 'ORIGIN_FORBIDDEN', 403)
      return
    }

    const refreshToken: string | undefined =
      (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined) ?? req.body?.refreshToken

    if (!refreshToken) {
      sendError(res, 'Refresh token required', 'REFRESH_REQUIRED', 400)
      return
    }

    try {
      const tokens = await authService.refreshAccessToken(refreshToken)
      authService.setTokenCookies(res, tokens)
      res.set('Cache-Control', 'no-store')
      sendSuccess(res, {})
    } catch (err) {
      // RefreshReuseError + verifyRefreshToken JsonWebTokenError both collapse
      // to generic 401. Server-side reason already logged to Sentry inside the
      // service — don't leak it back to the caller.
      if (err instanceof RefreshReuseError || (err as Error).name === 'JsonWebTokenError' || (err as Error).name === 'TokenExpiredError') {
        sendError(res, 'Invalid or expired refresh token', 'REFRESH_FAILED', 401)
        return
      }
      throw err
    }
  })
)

export default router
