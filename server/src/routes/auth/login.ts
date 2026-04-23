import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { captchaGuard, recordFailedAttempt } from '../../middleware/captcha.js'
import { loginSchema } from '../../schemas/auth.schemas.js'
import { prisma } from '../../lib/prisma.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import logger from '../../lib/logger.js'
import * as authService from '../../services/auth.service.js'
import { REFRESH_TOKEN_TTL_MS } from '../../config/security.js'

const router = Router()

/**
 * POST /api/auth/login
 * Login with phone or email + password. Works in all environments.
 */
router.post(
  '/login',
  authRateLimiter,
  captchaGuard,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body)
    if (!result.verified) {
      logger.warn('auth.login_failed', { ip: req.ip, userAgent: req.headers['user-agent'] })
      recordFailedAttempt(req.ip ?? 'unknown')
      sendError(res, result.message, 'LOGIN_FAILED', 400)
      return
    }

    await prisma.refreshToken.create({
      data: {
        userId: result.user!.id,
        token: result.tokens!.refreshToken,
        deviceInfo: req.headers['user-agent']?.slice(0, 200) || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    })

    authService.setTokenCookies(res, result.tokens!)
    res.set('Cache-Control', 'no-store')
    sendSuccess(res, {
      isNewUser: false,
      user: result.user,
      businesses: result.businesses ?? [],
      activeBusiness: result.activeBusiness ?? null,
    })
  })
)

export default router
