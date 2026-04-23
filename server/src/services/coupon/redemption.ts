/**
 * Coupon redemption operations — user-facing.
 * Validate, apply, remove.
 */

import { prisma } from '../../lib/prisma.js'
import { validationError, notFoundError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { computeStatus, calculateDiscount, COUPON_ERRORS } from './helpers.js'
import { couponFraudTracker } from '../coupon-fraud.js'
import type { ValidateCouponInput, ApplyCouponInput } from '../../schemas/coupon.schemas.js'

// ─── Validate (preview, no DB write) ─────────────────────────────────────

export async function validateCoupon(userId: string, data: ValidateCouponInput, ip?: string) {
  if (couponFraudTracker.isLockedOut(userId)) {
    logger.warn('coupon.validate_blocked', { userId, reason: 'lockout', ip })
    return {
      valid: false,
      error: { code: 'COUPON_RATE_LIMITED', message: 'Too many failed attempts. Please try again later.' },
    }
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: data.code } })

  if (!coupon) {
    couponFraudTracker.recordFailedValidation(userId, data.code, ip)
    logger.warn('coupon.validate_failed', { userId, code: data.code, reason: 'not_found', ip })
    return { valid: false, error: COUPON_ERRORS.NOT_FOUND }
  }

  const status = computeStatus(coupon)

  if (status !== 'ACTIVE') {
    const errorMap: Record<string, (typeof COUPON_ERRORS)[keyof typeof COUPON_ERRORS]> = {
      DEACTIVATED: COUPON_ERRORS.INACTIVE,
      EXPIRED: COUPON_ERRORS.EXPIRED,
      EXHAUSTED: COUPON_ERRORS.EXHAUSTED,
      SCHEDULED: COUPON_ERRORS.NOT_STARTED,
    }
    const error = errorMap[status] ?? COUPON_ERRORS.INACTIVE
    couponFraudTracker.recordFailedValidation(userId, data.code, ip)
    logger.warn('coupon.validate_failed', { userId, code: data.code, reason: status.toLowerCase(), ip })
    return { valid: false, error }
  }

  if (data.planId && coupon.planFilter.length > 0 && !coupon.planFilter.includes(data.planId)) {
    couponFraudTracker.recordFailedValidation(userId, data.code, ip)
    logger.warn('coupon.validate_failed', { userId, code: data.code, reason: 'plan_mismatch', ip })
    return { valid: false, error: COUPON_ERRORS.PLAN_MISMATCH }
  }

  if (coupon.minPurchaseAmount !== null && data.planAmountPaise !== undefined) {
    if (data.planAmountPaise < coupon.minPurchaseAmount) {
      couponFraudTracker.recordFailedValidation(userId, data.code, ip)
      logger.warn('coupon.validate_failed', { userId, code: data.code, reason: 'min_amount', ip })
      return { valid: false, error: COUPON_ERRORS.MIN_AMOUNT }
    }
  }

  const userRedemptions = await prisma.couponRedemption.count({
    where: { couponId: coupon.id, userId },
  })
  if (userRedemptions >= coupon.maxUsesPerUser) {
    couponFraudTracker.recordFailedValidation(userId, data.code, ip)
    logger.warn('coupon.validate_failed', { userId, code: data.code, reason: 'already_used', ip })
    return { valid: false, error: COUPON_ERRORS.ALREADY_USED }
  }

  const subtotal = data.planAmountPaise ?? 0
  const discountPreview = subtotal > 0 ? calculateDiscount(coupon.discountType, coupon.discountValue, subtotal) : 0

  const message =
    coupon.discountType === 'PERCENTAGE'
      ? `${coupon.discountValue / 100}% off${coupon.appliesTo === 'FIRST_CYCLE' ? ' your first month' : ''}!${subtotal > 0 ? ` You save ₹${(discountPreview / 100).toFixed(2)}` : ''}`
      : `₹${(coupon.discountValue / 100).toFixed(2)} off${coupon.appliesTo === 'FIRST_CYCLE' ? ' your first month' : ''}!`

  return {
    valid: true,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountPreview,
    appliesTo: coupon.appliesTo,
    message,
  }
}

// ─── Apply (DB write, atomic) ─────────────────────────────────────────────

export async function applyCoupon(userId: string, data: ApplyCouponInput, ip?: string) {
  const coupon = await prisma.coupon.findUnique({ where: { code: data.code } })
  if (!coupon) throw validationError(COUPON_ERRORS.NOT_FOUND.message)

  const status = computeStatus(coupon)
  if (status !== 'ACTIVE') {
    const errorKey = status as keyof typeof COUPON_ERRORS
    throw validationError(COUPON_ERRORS[errorKey]?.message ?? 'Coupon is not active')
  }

  if (data.planId && coupon.planFilter.length > 0 && !coupon.planFilter.includes(data.planId)) {
    throw validationError(COUPON_ERRORS.PLAN_MISMATCH.message)
  }

  if (coupon.minPurchaseAmount !== null && data.planAmountPaise !== undefined) {
    if (data.planAmountPaise < coupon.minPurchaseAmount) {
      throw validationError(COUPON_ERRORS.MIN_AMOUNT.message)
    }
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const userRedemptions = await tx.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      })
      if (userRedemptions >= coupon.maxUsesPerUser) {
        throw validationError(COUPON_ERRORS.ALREADY_USED.message)
      }

      const updated = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          ...(coupon.maxUses !== null ? { usageCount: { lt: coupon.maxUses } } : {}),
        },
        data: { usageCount: { increment: 1 } },
      })

      if (updated.count === 0) {
        throw validationError(COUPON_ERRORS.EXHAUSTED.message)
      }

      const subtotal = data.planAmountPaise ?? 0
      const discountApplied =
        subtotal > 0 ? calculateDiscount(coupon.discountType, coupon.discountValue, subtotal) : 0

      const redemption = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
          discountApplied,
          planId: data.planId ?? null,
          razorpaySubscriptionId: data.razorpaySubscriptionId ?? null,
          metadata: { ip: ip ?? 'unknown' } as object,
        },
      })

      return { redemption, discountApplied }
    },
    { isolationLevel: 'Serializable' }
  )

  logger.info('coupon.applied', {
    couponId: coupon.id,
    code: coupon.code,
    userId,
    discountApplied: result.discountApplied,
  })

  const couponWithOffer = await prisma.coupon.findUnique({
    where: { code: data.code },
    select: { razorpayOfferId: true },
  })
  const razorpayOfferLinked = Boolean(couponWithOffer?.razorpayOfferId)

  return {
    redemption: result.redemption,
    razorpayOfferLinked,
    razorpayOfferId: couponWithOffer?.razorpayOfferId ?? null,
  }
}

// ─── Remove ───────────────────────────────────────────────────────────────

export async function removeRedemption(userId: string, redemptionId: string, ip?: string) {
  if (couponFraudTracker.isCycling(userId)) {
    logger.warn('coupon.remove_blocked', { userId, reason: 'cycling', ip })
    throw validationError('Too many coupon changes. Please try again later.')
  }

  const redemption = await prisma.couponRedemption.findUnique({
    where: { id: redemptionId },
  })

  if (!redemption) throw notFoundError('Coupon redemption')
  if (redemption.userId !== userId) throw notFoundError('Coupon redemption')

  couponFraudTracker.recordRemove(userId, ip)

  await prisma.$transaction(async (tx) => {
    const updated = await tx.coupon.updateMany({
      where: { id: redemption.couponId, usageCount: { gt: 0 } },
      data: { usageCount: { decrement: 1 } },
    })

    if (updated.count === 0) {
      logger.warn('coupon.remove_skip_decrement', {
        redemptionId,
        couponId: redemption.couponId,
        reason: 'usageCount already at 0',
      })
    }

    await tx.couponRedemption.delete({ where: { id: redemptionId } })
  })

  logger.info('coupon.removed', { redemptionId, couponId: redemption.couponId, userId })
  return { removed: true }
}

