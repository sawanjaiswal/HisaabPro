import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { captchaGuard, recordFailedAttempt } from '../../middleware/captcha.js'
import {
  registerSchema,
  verifyRegistrationSchema,
  resendOtpSchema,
} from '../../schemas/auth.schemas.js'
import { prisma } from '../../lib/prisma.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import logger from '../../lib/logger.js'
import * as authService from '../../services/auth.service.js'
import { REFRESH_TOKEN_TTL_MS } from '../../config/security.js'

const router = Router()

/**
 * POST /api/auth/register
 * Step 1: validate name/phone/password, send OTP. User is created after verify-registration.
 */
router.post(
  '/register',
  authRateLimiter,
  captchaGuard,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body)
    if (!result.sent) {
      sendError(res, result.message, 'REGISTER_FAILED', 400)
      return
    }
    sendSuccess(res, { message: result.message })
  })
)

/**
 * POST /api/auth/verify-registration
 * Step 2: verify OTP, create user account, set cookies.
 */
router.post(
  '/verify-registration',
  authRateLimiter,
  validate(verifyRegistrationSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyRegistration(req.body)
    if (!result.verified) {
      logger.warn('auth.verify_registration_failed', { ip: req.ip, phone: req.body.phone })
      recordFailedAttempt(req.ip ?? 'unknown')
      sendError(res, result.message, 'OTP_INVALID', 400)
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
      isNewUser: true,
      user: result.user,
      businesses: [],
      activeBusiness: null,
    }, 201)
  })
)

/**
 * POST /api/auth/resend-otp
 * Resend OTP — enforces 30s cooldown.
 */
router.post(
  '/resend-otp',
  authRateLimiter,
  validate(resendOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.resendOtp(req.body.phone as string)
    if (!result.sent) {
      sendError(res, result.message, 'RESEND_FAILED', 400)
      return
    }
    sendSuccess(res, { message: result.message, resendAvailableAt: result.resendAvailableAt })
  })
)

export default router
