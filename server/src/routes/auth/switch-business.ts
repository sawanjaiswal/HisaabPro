import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { auth } from '../../middleware/auth.js'
import { switchBusinessRateLimiter } from '../../middleware/rate-limit.js'
import { switchBusinessSchema } from '../../schemas/auth.schemas.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { blacklistToken } from '../../lib/token-blacklist.js'
import { decodeToken } from '../../lib/jwt.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import * as authService from '../../services/auth.service.js'
import { emitBusinessSwitchAudit } from '../../services/auth/switch-business-audit.js'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../config/security.js'

const router = Router()

/**
 * POST /api/auth/switch-business
 * Switch to a different business. Issues new JWT, rotates cookies.
 */
router.post(
  '/switch-business',
  auth,
  switchBusinessRateLimiter,
  validate(switchBusinessSchema),
  asyncHandler(async (req, res) => {
    const { userId, phone, businessId: currentBusinessId } = req.user!
    const { businessId: targetBusinessId } = req.body

    if (targetBusinessId === currentBusinessId) {
      sendError(res, 'Already on this business', 'ALREADY_ACTIVE', 400)
      return
    }

    // Membership is checked and the new tokens are minted FIRST. Invalidating
    // the caller's current tokens before knowing the switch is allowed means a
    // refused switch — a stale entry in the switcher, a business the user was
    // removed from — logs them out of the session they were legitimately in.
    const result = await authService.switchBusiness(userId, phone, targetBusinessId)

    // Only now: retire the tokens that carried the old businessId.
    const rawAccessToken =
      (req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ??
      req.headers.authorization?.slice(7)
    if (rawAccessToken) {
      const decoded = decodeToken(rawAccessToken)
      const ttl = decoded?.exp ? decoded.exp * 1000 - Date.now() : 15 * 60 * 1000
      if (ttl > 0) blacklistToken(rawAccessToken, ttl)
    }

    // P3.15 — revoke old refresh token row so attacker can't rotate back
    // to the prior business. Family-rotation aware: also blacklist the raw
    // token in case it predates the family-rotation rollout.
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined
    if (rawRefreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: rawRefreshToken, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'switch-business' },
      })
      const decoded = decodeToken(rawRefreshToken)
      const ttl = decoded?.exp ? decoded.exp * 1000 - Date.now() : 7 * 24 * 60 * 60 * 1000
      if (ttl > 0) blacklistToken(rawRefreshToken, ttl)
    }

    authService.setTokenCookies(res, result.tokens)

    res.set('Cache-Control', 'no-store')
    logger.info('auth.business_switched', {
      userId,
      from: currentBusinessId,
      to: targetBusinessId,
    })

    // Phase 6 #138 PR2 — audit the rotation in the TARGET firm's trail so its
    // owner can see who switched in and where they came from. Fire-and-forget;
    // failure logs but does not block the response.
    await emitBusinessSwitchAudit({
      actorUserId: userId,
      fromBusinessId: currentBusinessId || null,
      toBusinessId: targetBusinessId,
      toBusinessName: result.business?.name,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    })

    sendSuccess(res, { business: result.business })
  })
)

export default router
