import { Router } from 'express'
import { randomUUID } from 'crypto'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { authRateLimiter } from '../middleware/rate-limit.js'
import { captchaGuard, recordFailedAttempt } from '../middleware/captcha.js'
import {
  logoutSchema, devLoginSchema, switchBusinessSchema,
  registerSchema, loginSchema, verifyRegistrationSchema,
  sendOtpSchema, verifyOtpSchema, resendOtpSchema,
  forgotPasswordSchema, resetPasswordSchema,
} from '../schemas/auth.schemas.js'
import { prisma } from '../lib/prisma.js'
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
  REFRESH_TOKEN_TTL_MS,
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
    const isProduction = process.env.NODE_ENV === 'production'
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: CSRF_COOKIE_TTL_MS,
    })
  }

  res.set(CSRF_HEADER_NAME, token)
  sendSuccess(res, { csrfToken: token })
})

// ---------------------------------------------------------------------------
// Password login (MVP — used across dev + production closed testing)
// ---------------------------------------------------------------------------

{
  /**
   * POST /api/auth/dev-login
   * MVP: login with username + password (no OTP needed).
   * Creates user if not exists. Sets httpOnly cookie tokens.
   */
  router.post(
    '/dev-login',
    authRateLimiter,
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
}

// ---------------------------------------------------------------------------
// Registration + OTP verification
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Production login — phone or email + password
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Password reset (OTP-based)
// ---------------------------------------------------------------------------

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
        : 7 * 24 * 60 * 60 * 1000
      if (refreshTtl > 0) blacklistToken(refreshToken, refreshTtl)
    }

    // Clear cookies
    authService.clearTokenCookies(res)

    res.set('Cache-Control', 'no-store')
    sendSuccess(res, { message: 'Logged out successfully' })
  })
)

// ---------------------------------------------------------------------------
// Switch business
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/me
 * Get current user profile with businesses list and active business.
 */
router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const data = await authService.getMe(req.user!.userId, req.user!.businessId)
    if (!data) {
      sendError(res, 'User not found', 'NOT_FOUND', 404)
      return
    }
    res.set('Cache-Control', 'no-store')
    sendSuccess(res, data)
  })
)

export default router
