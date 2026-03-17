import { Router } from 'express'
import { randomUUID } from 'crypto'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { authRateLimiter } from '../middleware/rate-limit.js'
import { captchaGuard, recordFailedAttempt } from '../middleware/captcha.js'
import { logoutSchema, devLoginSchema } from '../schemas/auth.schemas.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { isBlacklisted, blacklistToken } from '../lib/token-blacklist.js'
import { decodeToken } from '../lib/jwt.js'
import logger from '../lib/logger.js'
import * as authService from '../services/auth.service.js'
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_TTL_MS,
  REFRESH_TOKEN_COOKIE,
} from '../config/security.js'

const router = Router()

// ---------------------------------------------------------------------------
// CSRF token endpoint (Feature #63)
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/csrf-token
 * Issue a CSRF token via httpOnly cookie + response body.
 * Frontend reads token from body, stores in memory, sends as X-CSRF-Token header.
 */
router.get('/csrf-token', (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined
  const token = existing ?? randomUUID()

  if (!existing) {
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: CSRF_COOKIE_TTL_MS,
    })
  }

  res.set(CSRF_HEADER_NAME, token)
  sendSuccess(res, { csrfToken: token })
})

// ---------------------------------------------------------------------------
// Dev login
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/dev-login
 * Dev-only: login with username + password (no OTP needed).
 * Creates user if not exists. Sets httpOnly cookie tokens.
 * Also returns tokens in body for backward-compat during migration period.
 */
router.post(
  '/dev-login',
  captchaGuard,
  validate(devLoginSchema),
  asyncHandler(async (req, res) => {
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

    // Set tokens as httpOnly cookies
    authService.setTokenCookies(res, result.tokens!)

    sendSuccess(res, {
      isNewUser: result.isNewUser,
      user: result.user,
      tokens: result.tokens,
    }, result.isNewUser as boolean ? 201 : 200)
  })
)

// ---------------------------------------------------------------------------
// OTP-based auth (commented out for dev — restore for production)
// ---------------------------------------------------------------------------

// /**
//  * POST /api/auth/send-otp
//  * Send OTP to phone number for login/signup
//  */
// router.post(
//   '/send-otp',
//   authRateLimiter,
//   validate(sendOtpSchema),
//   asyncHandler(async (req, res) => {
//     const result = await authService.sendOtp(req.body)
//     if (!result.sent) {
//       sendError(res, result.message, 'OTP_FAILED', 400)
//       return
//     }
//     sendSuccess(res, { message: result.message })
//   })
// )

// /**
//  * POST /api/auth/verify-otp
//  * Verify OTP, auto-create user if new, return tokens + set cookies
//  */
// router.post(
//   '/verify-otp',
//   otpRateLimiter,
//   captchaGuard,
//   validate(verifyOtpSchema),
//   asyncHandler(async (req, res) => {
//     const result = await authService.verifyOtp(req.body)
//     if (!result.verified) {
//       logger.warn('auth.otp_failed', {
//         ip: req.ip,
//         phone: req.body.phone,
//         userAgent: req.headers['user-agent'],
//       })
//       recordFailedAttempt(req.ip ?? 'unknown')
//       sendError(res, result.message, 'OTP_INVALID', 400)
//       return
//     }
//
//     authService.setTokenCookies(res, result.tokens!)
//
//     sendSuccess(res, {
//       isNewUser: result.isNewUser,
//       user: result.user,
//       tokens: result.tokens,
//     }, result.isNewUser as boolean ? 201 : 200)
//   })
// )

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

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

      // Rotate both cookies
      authService.setTokenCookies(res, tokens)

      // Also return in body for backward-compat
      sendSuccess(res, { tokens })
    } catch {
      sendError(res, 'Invalid or expired refresh token', 'REFRESH_FAILED', 401)
    }
  })
)

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/logout
 * Blacklist access + refresh tokens and clear cookies.
 */
router.post(
  '/logout',
  auth,
  validate(logoutSchema),
  asyncHandler(async (req, res) => {
    // Extract the raw access token (cookie first, then header)
    const rawAccessToken =
      (req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ??
      req.headers.authorization?.slice(7)

    if (rawAccessToken) {
      const accessDecoded = decodeToken(rawAccessToken)
      const accessTtl = accessDecoded?.exp
        ? accessDecoded.exp * 1000 - Date.now()
        : 15 * 60 * 1000
      if (accessTtl > 0) blacklistToken(rawAccessToken, accessTtl)
    }

    // Blacklist refresh token from cookie or body
    const refreshToken =
      (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined) ?? req.body?.refreshToken

    if (refreshToken) {
      const refreshDecoded = decodeToken(refreshToken)
      const refreshTtl = refreshDecoded?.exp
        ? refreshDecoded.exp * 1000 - Date.now()
        : 30 * 24 * 60 * 60 * 1000
      if (refreshTtl > 0) blacklistToken(refreshToken, refreshTtl)
    }

    // Clear cookies
    authService.clearTokenCookies(res)

    sendSuccess(res, { message: 'Logged out successfully' })
  })
)

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/me
 * Get current user profile.
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
