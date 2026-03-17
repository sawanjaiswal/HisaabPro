/**
 * Referral & Earn Routes — Feature #3
 * Adapted from DudhHisaab referral.routes.ts
 *
 * All authenticated routes require JWT via auth middleware.
 * POST endpoints are rate-limited (10 req / 15 min) to prevent abuse.
 */

import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { auth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import {
  applyReferralCodeSchema,
  withdrawReferralSchema,
  referralRewardsQuerySchema,
} from '../schemas/referral.schemas.js'
import * as referral from '../services/referral.service.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

// ============================================================
// PUBLIC — no auth required
// ============================================================

/**
 * GET /api/referral/validate
 * Validate a referral code before signup.
 * Query: ?code=RAJU9K3M
 */
router.get(
  '/validate',
  asyncHandler(async (req, res) => {
    const code = req.query.code as string | undefined
    if (!code) {
      sendError(res, 'code query param is required', 'VALIDATION_ERROR', 400)
      return
    }

    const record = await referral.resolveCode(code)
    if (!record) {
      sendSuccess(res, { valid: false, message: 'Invalid referral code' })
      return
    }

    sendSuccess(res, {
      valid: true,
      referrerName: record.user.name ?? 'Anonymous',
    })
  })
)

// ============================================================
// AUTHENTICATED
// ============================================================

/**
 * POST /api/referral/generate
 * Generate (or return existing) referral code for the authenticated user.
 */
router.post(
  '/generate',
  auth,
  postLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const code = await referral.generateReferralCode(userId, user?.name ?? null)
    sendSuccess(res, { code: code.code, link: code.link })
  })
)

/**
 * GET /api/referral/my-code
 * Get current user's referral code, auto-generating if not yet created.
 */
router.get(
  '/my-code',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId

    // Auto-create on first visit (idempotent)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    const codeRecord = await referral.generateReferralCode(userId, user?.name ?? null)
    const stats = await referral.getReferralStats(userId)

    sendSuccess(res, {
      code: codeRecord.code,
      link: codeRecord.link,
      stats: {
        totalReferrals: stats.totalReferrals,
        qualifiedReferrals: stats.qualifiedReferrals,
        pendingReferrals: stats.pendingReferrals,
        totalEarned: stats.totalEarned,
      },
    })
  })
)

/**
 * GET /api/referral/rewards
 * List referral rewards (cursor-based pagination).
 * Query: ?cursor=<id>&limit=<n>
 */
router.get(
  '/rewards',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId

    const parsed = referralRewardsQuerySchema.safeParse({
      cursor: req.query.cursor,
      limit: req.query.limit,
    })
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0].message, 'VALIDATION_ERROR', 400)
      return
    }

    const result = await referral.listRewards(userId, parsed.data.cursor, parsed.data.limit)
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: { nextCursor: result.nextCursor, total: result.total },
    })
  })
)

/**
 * GET /api/referral/stats
 * Total referrals, earned, pending, wallet balance.
 */
router.get(
  '/stats',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const stats = await referral.getReferralStats(userId)
    sendSuccess(res, stats)
  })
)

/**
 * POST /api/referral/apply
 * Apply a referral code (during signup / onboarding window).
 * Body: { referralCode: string }
 */
router.post(
  '/apply',
  auth,
  validate(applyReferralCodeSchema),
  postLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const { referralCode } = req.body as { referralCode: string }

    const meta = {
      ipAddress: req.ip,
      deviceFingerprint: req.headers['x-device-id'] as string | undefined,
    }

    try {
      const result = await referral.applyReferralCode(userId, referralCode, meta)
      sendSuccess(res, { ...result, message: `You were referred by ${result.referrerName}` })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply referral code'
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, message)
    }
  })
)

/**
 * POST /api/referral/withdraw
 * Request UPI withdrawal (stub — Razorpay wired in later iteration).
 * Body: { amount: number, upiId: string }
 */
router.post(
  '/withdraw',
  auth,
  validate(withdrawReferralSchema),
  postLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const { amount, upiId } = req.body as { amount: number; upiId: string }

    try {
      const result = await referral.requestWithdrawal(userId, amount, upiId)
      sendSuccess(res, {
        ...result,
        message: result.autoApproved
          ? 'Withdrawal approved. Amount will be sent within 24 hours.'
          : 'Withdrawal request submitted for review (2-3 business days).',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process withdrawal'
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, message)
    }
  })
)

/**
 * GET /api/referral/withdrawals
 * Withdrawal history (offset paginated).
 * Query: ?page=<n>&limit=<n>
 */
router.get(
  '/withdrawals',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)

    const result = await referral.listWithdrawals(userId, page, limit)
    sendSuccess(res, result)
  })
)

export default router
