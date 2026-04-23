import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { captchaGuard } from '../../middleware/captcha.js'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../schemas/auth.schemas.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import * as authService from '../../services/auth.service.js'

const router = Router()

/**
 * POST /api/auth/forgot-password
 * Step 1: Send OTP to registered phone.
 */
router.post(
  '/forgot-password',
  authRateLimiter,
  captchaGuard,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body)
    if (!result.sent) {
      sendError(res, result.message, 'OTP_FAILED', 400)
      return
    }
    sendSuccess(res, { message: result.message })
  })
)

/**
 * POST /api/auth/reset-password
 * Step 2: Verify OTP and set new password.
 */
router.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body)
    if (!result.success) {
      sendError(res, result.message, 'RESET_FAILED', 400)
      return
    }
    sendSuccess(res, { message: result.message })
  })
)

export default router
