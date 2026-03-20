/**
 * User Coupon Routes — Feature #96
 *
 * POST   /api/coupons/validate   — validate coupon code (preview)
 * POST   /api/coupons/apply      — apply coupon to subscription
 * DELETE /api/coupons/remove     — remove applied coupon before payment
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { couponValidateRateLimiter, couponIpRateLimiter } from '../middleware/rate-limit.js'
import {
  validateCouponSchema,
  applyCouponSchema,
  removeCouponSchema,
} from '../schemas/coupon.schemas.js'
import {
  validateCoupon,
  applyCoupon,
  removeRedemption,
} from '../services/coupon.service.js'
import { sendSuccess, sendError } from '../lib/response.js'

const router = Router()

// All coupon user routes require authentication
router.use(auth)

// ─── POST /validate — preview discount ───────────────────────────────────

router.post(
  '/validate',
  couponIpRateLimiter,
  couponValidateRateLimiter,
  validate(validateCouponSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const result = await validateCoupon(userId, req.body, req.ip)

    if (!result.valid) {
      sendError(res, result.error?.message ?? 'Invalid coupon', result.error?.code ?? 'INVALID_COUPON', 400)
      return
    }

    sendSuccess(res, result)
  })
)

// ─── POST /apply — apply coupon to checkout ──────────────────────────────

router.post(
  '/apply',
  couponIpRateLimiter,
  couponValidateRateLimiter,
  validate(applyCouponSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const result = await applyCoupon(userId, req.body, req.ip)
    sendSuccess(res, result, 201)
  })
)

// ─── DELETE /remove — remove coupon before payment ───────────────────────

router.delete(
  '/remove',
  couponIpRateLimiter,
  validate(removeCouponSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const result = await removeRedemption(userId, req.body.redemptionId, req.ip)
    sendSuccess(res, result)
  })
)

export default router
