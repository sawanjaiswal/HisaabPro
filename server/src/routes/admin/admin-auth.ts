/**
 * Admin Auth Routes
 * POST /api/admin/auth/login
 * POST /api/admin/auth/refresh
 * POST /api/admin/auth/logout
 * GET  /api/admin/auth/me
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { requireAdmin, auditAdminAction } from '../../middleware/admin-auth.js'
import {
  adminLoginSchema,
  adminRefreshSchema,
} from '../../schemas/admin.schemas.js'
import {
  adminLogin,
  getAdminProfile,
  refreshAdminToken,
} from '../../services/admin/index.js'
import { sendSuccess } from '../../lib/response.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { blacklistToken, isBlacklisted } from '../../lib/token-blacklist.js'
import { captchaGuard, recordFailedAttempt } from '../../middleware/captcha.js'
import { sendError } from '../../lib/response.js'

const router = Router()

// --------------------------------------------------------------------------
// POST /login — email + password → tokens
// --------------------------------------------------------------------------

router.post(
  '/login',
  authRateLimiter,
  captchaGuard,
  validate(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string }
    try {
      const result = await adminLogin(email, password)
      sendSuccess(res, result)
    } catch (err) {
      recordFailedAttempt(req.ip ?? 'unknown')
      throw err
    }
  })
)

// --------------------------------------------------------------------------
// POST /refresh — swap refresh token for new access token
// --------------------------------------------------------------------------

router.post(
  '/refresh',
  authRateLimiter,
  validate(adminRefreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string }

    // Reject blacklisted refresh tokens (replay attack prevention)
    if (isBlacklisted(refreshToken)) {
      sendError(res, 'Token has been revoked', 'TOKEN_REVOKED', 401)
      return
    }

    const tokens = await refreshAdminToken(refreshToken)

    // Blacklist old refresh token to prevent replay
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
    blacklistToken(refreshToken, SEVEN_DAYS_MS)

    sendSuccess(res, tokens)
  })
)

// --------------------------------------------------------------------------
// POST /logout — audit and return 200 (client discards token)
// --------------------------------------------------------------------------

router.post(
  '/logout',
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Blacklist the access token used in this request
    const rawToken = req.headers.authorization?.slice(7)
    if (rawToken) {
      const FIFTEEN_MIN_MS = 15 * 60 * 1000
      blacklistToken(rawToken, FIFTEEN_MIN_MS)
    }

    // Blacklist refresh token if provided in body
    const { refreshToken } = req.body as { refreshToken?: string }
    if (refreshToken) {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
      blacklistToken(refreshToken, SEVEN_DAYS_MS)
    }

    await auditAdminAction(req, 'LOGOUT')
    sendSuccess(res, { message: 'Logged out successfully' })
  })
)

// --------------------------------------------------------------------------
// GET /me — current admin profile
// --------------------------------------------------------------------------

router.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const profile = await getAdminProfile(req.admin!.adminId)
    sendSuccess(res, profile)
  })
)

export default router
