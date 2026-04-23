import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { devLoginRateLimiter } from '../../middleware/rate-limit.js'
import { captchaGuard, recordFailedAttempt } from '../../middleware/captcha.js'
import { devLoginSchema } from '../../schemas/auth.schemas.js'
import { prisma } from '../../lib/prisma.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import logger from '../../lib/logger.js'
import * as authService from '../../services/auth.service.js'
import { REFRESH_TOKEN_TTL_MS } from '../../config/security.js'

const router = Router()

/**
 * POST /api/auth/dev-login
 * MVP: login with username + password (no OTP needed).
 * Creates user if not exists. Sets httpOnly cookie tokens.
 */
router.post(
  '/dev-login',
  devLoginRateLimiter,
  captchaGuard,
  validate(devLoginSchema),
  asyncHandler(async (req, res) => {
    if (process.env.ALLOW_DEV_LOGIN !== 'true') {
      sendError(res, 'Not found', 'NOT_FOUND', 404)
      return
    }
    const result = await authService.devLogin(req.body)

    if (!result.verified) {
      logger.warn('auth.login_failed', {
        ip: req.ip,
        username: req.body.username,
        userAgent: req.headers['user-agent'],
      })
      recordFailedAttempt(req.ip ?? 'unknown')
      sendError(res, result.message, 'LOGIN_FAILED', 400)
      return
    }

    // Store refresh token in DB for session management
    await prisma.refreshToken.create({
      data: {
        userId: result.user!.id,
        token: result.tokens!.refreshToken,
        deviceInfo: (req.body.deviceInfo as string | undefined)?.slice(0, 200) || req.headers['user-agent']?.slice(0, 200) || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    })

    // Set tokens as httpOnly cookies
    authService.setTokenCookies(res, result.tokens!)

    // Fetch businesses for the user (same shape as /me)
    const meData = await authService.getMe(result.user!.id)

    res.set('Cache-Control', 'no-store')
    sendSuccess(res, {
      isNewUser: result.isNewUser,
      user: result.user,
      businesses: meData?.businesses ?? [],
      activeBusiness: meData?.activeBusiness ?? null,
    }, result.isNewUser as boolean ? 201 : 200)
  })
)

export default router
