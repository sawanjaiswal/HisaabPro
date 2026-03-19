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
import { couponValidateRateLimiter } from '../middleware/rate-limit.js'
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
import { sendSuccess } from '../lib/response.js'

const router = Router()

// All coupon user routes require authentication
router.use(auth)

// ─── POST /validate — preview discount ───────────────────────────────────

router.post(
  '/validate',
  couponValidateRateLimiter,
  validate(validateCouponSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const result = await validateCoupon(userId, req.body)

    if (!result.valid) {
      res.status(400).json({
        success: false,
        error: result.error,
      })
      return
    }

    sendSuccess(res, result)
  })
)

// ─── POST /apply — apply coupon to checkout ──────────────────────────────

router.post(
  '/apply',
  couponValidateRateLimiter,
  validate(applyCouponSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const result = await applyCoupon(userId, req.body)
    sendSuccess(res, result, 201)
  })
)

// ─── DELETE /remove — remove coupon before payment ───────────────────────

router.delete(
  '/remove',
  validate(removeCouponSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const result = await removeRedemption(userId, req.body.redemptionId)
    sendSuccess(res, result)
  })
)

export default router
