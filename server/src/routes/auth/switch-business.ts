import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { auth } from '../../middleware/auth.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { switchBusinessSchema } from '../../schemas/auth.schemas.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { blacklistToken } from '../../lib/token-blacklist.js'
import { decodeToken } from '../../lib/jwt.js'
import logger from '../../lib/logger.js'
import * as authService from '../../services/auth.service.js'
import { ACCESS_TOKEN_COOKIE } from '../../config/security.js'

const router = Router()

/**
 * POST /api/auth/switch-business
 * Switch to a different business. Issues new JWT, rotates cookies.
 */
router.post(
  '/switch-business',
  auth,
  authRateLimiter,
  validate(switchBusinessSchema),
  asyncHandler(async (req, res) => {
    const { userId, phone, businessId: currentBusinessId } = req.user!
    const { businessId: targetBusinessId } = req.body

    if (targetBusinessId === currentBusinessId) {
      sendError(res, 'Already on this business', 'ALREADY_ACTIVE', 400)
      return
    }

    // Blacklist old access token
    const rawAccessToken =
      (req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ??
      req.headers.authorization?.slice(7)
    if (rawAccessToken) {
      const decoded = decodeToken(rawAccessToken)
      const ttl = decoded?.exp ? decoded.exp * 1000 - Date.now() : 15 * 60 * 1000
      if (ttl > 0) blacklistToken(rawAccessToken, ttl)
    }

    const result = await authService.switchBusiness(userId, phone, targetBusinessId)

    authService.setTokenCookies(res, result.tokens)

    res.set('Cache-Control', 'no-store')
    logger.info('auth.business_switched', {
      userId,
      from: currentBusinessId,
      to: targetBusinessId,
    })

    sendSuccess(res, { business: result.business })
  })
)

export default router
