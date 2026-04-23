import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { auth } from '../../middleware/auth.js'
import { logoutSchema } from '../../schemas/auth.schemas.js'
import { sendSuccess } from '../../lib/response.js'
import { blacklistToken } from '../../lib/token-blacklist.js'
import { decodeToken } from '../../lib/jwt.js'
import * as authService from '../../services/auth.service.js'
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../../config/security.js'

const router = Router()

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

export default router
