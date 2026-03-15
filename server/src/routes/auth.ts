import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { authRateLimiter, otpRateLimiter } from '../middleware/rate-limit.js'
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema, logoutSchema } from '../schemas/auth.schemas.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { isBlacklisted, blacklistToken } from '../lib/token-blacklist.js'
import { decodeToken } from '../lib/jwt.js'
import * as authService from '../services/auth.service.js'

const router = Router()

/**
 * POST /api/auth/send-otp
 * Send OTP to phone number for login/signup
 */
router.post(
  '/send-otp',
  authRateLimiter,
  validate(sendOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.sendOtp(req.body)
    if (!result.sent) {
      sendError(res, result.message, 'OTP_FAILED', 400)
      return
    }
    sendSuccess(res, { message: result.message })
  })
)

/**
 * POST /api/auth/verify-otp
 * Verify OTP, auto-create user if new, return tokens
 */
router.post(
  '/verify-otp',
  otpRateLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyOtp(req.body)
    if (!result.verified) {
      sendError(res, result.message, 'OTP_INVALID', 400)
      return
    }
    sendSuccess(res, {
      isNewUser: result.isNewUser,
      user: result.user,
      tokens: result.tokens,
    }, result.isNewUser as boolean ? 201 : 200)
  })
)

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  authRateLimiter,
  validate(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body

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
      sendSuccess(res, { tokens })
    } catch {
      sendError(res, 'Invalid or expired refresh token', 'REFRESH_FAILED', 401)
    }
  })
)

/**
 * POST /api/auth/logout
 * Blacklist access + refresh tokens
 */
router.post(
  '/logout',
  auth,
  validate(logoutSchema),
  asyncHandler(async (req, res) => {
    // Blacklist access token
    const accessToken = req.headers.authorization!.slice(7)
    const accessDecoded = decodeToken(accessToken)
    const accessTtl = accessDecoded?.exp ? accessDecoded.exp * 1000 - Date.now() : 15 * 60 * 1000
    if (accessTtl > 0) blacklistToken(accessToken, accessTtl)

    // Blacklist refresh token if provided
    const { refreshToken } = req.body
    if (refreshToken) {
      const refreshDecoded = decodeToken(refreshToken)
      const refreshTtl = refreshDecoded?.exp ? refreshDecoded.exp * 1000 - Date.now() : 30 * 24 * 60 * 60 * 1000
      if (refreshTtl > 0) blacklistToken(refreshToken, refreshTtl)
    }

    sendSuccess(res, { message: 'Logged out successfully' })
  })
)

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user!.userId)
    if (!user) {
      sendError(res, 'User not found', 'NOT_FOUND', 404)
      return
    }
    sendSuccess(res, { user })
  })
)

export default router
