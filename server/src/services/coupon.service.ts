/**
 * Coupon / Discount Code Service — Feature #96
 *
 * CRUD + validation + application + bulk generation.
 * Platform-level coupons for HisaabPro subscriptions.
 */

import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { validationError, notFoundError, conflictError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import {
  SUFFIX_CHARS,
  SUFFIX_LENGTH,
  MAX_PERCENTAGE_BASIS_POINTS,
  PERCENTAGE_CAP_MSG,
  DETAIL_REDEMPTIONS_LIMIT,
} from '../config/coupon.config.js'
import type { CouponStatus } from '../config/coupon.config.js'
import { couponFraudTracker } from './coupon-fraud.js'
import type {
  CreateCouponInput,
  UpdateCouponInput,
  BulkCreateCouponsInput,
  ListCouponsQuery,
  ValidateCouponInput,
  ApplyCouponInput,
} from '../schemas/coupon.schemas.js'

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Derive coupon status at runtime — never stored in DB */
function computeStatus(coupon: {
  isActive: boolean
  validFrom: Date
  validUntil: Date | null
  maxUses: number | null
  usageCount: number
}): CouponStatus {
  if (!coupon.isActive) return 'DEACTIVATED'
  const now = new Date()
  if (coupon.validUntil && now > coupon.validUntil) return 'EXPIRED'
  if (coupon.maxUses !== null && coupon.usageCount >= coupon.maxUses) return 'EXHAUSTED'
  if (now < coupon.validFrom) return 'SCHEDULED'
  return 'ACTIVE'
}

/** Add computed status to a coupon */
function withStatus<T extends { isActive: boolean; validFrom: Date; validUntil: Date | null; maxUses: number | null; usageCount: number }>(
  coupon: T
): T & { status: CouponStatus } {
  return { ...coupon, status: computeStatus(coupon) }
}

/** Generate a random suffix for bulk codes (no ambiguous chars) */
function generateSuffix(length = SUFFIX_LENGTH): string {
  let suffix = ''
  for (let i = 0; i < length; i++) {
    suffix += SUFFIX_CHARS[crypto.randomInt(SUFFIX_CHARS.length)]
  }
  return suffix
}

/**
 * Coupon validation error codes — per PRD §4.
 * These are returned to the client so they can show specific messages.
 */
const COUPON_ERRORS = {
  NOT_FOUND: { code: 'COUPON_NOT_FOUND', message: 'Invalid coupon code' },
  EXPIRED: { code: 'COUPON_EXPIRED', message: 'This coupon has expired' },
  EXHAUSTED: { code: 'COUPON_EXHAUSTED', message: 'This coupon has been fully redeemed' },
  ALREADY_USED: { code: 'COUPON_ALREADY_USED', message: 'You have already used this coupon' },
  INACTIVE: { code: 'COUPON_INACTIVE', message: 'This coupon is not currently active' },
  NOT_STARTED: { code: 'COUPON_NOT_STARTED', message: 'This coupon is not yet active' },
  PLAN_MISMATCH: { code: 'COUPON_PLAN_MISMATCH', message: 'This coupon does not apply to your selected plan' },
  MIN_AMOUNT: { code: 'COUPON_MIN_AMOUNT', message: 'Your order does not meet the minimum amount for this coupon' },
} as const

// ─── Admin: Create ───────────────────────────────────────────────────────

export async function createCoupon(adminId: string, data: CreateCouponInput) {
  const existing = await prisma.coupon.findUnique({ where: { code: data.code } })
  if (existing) throw conflictError('Coupon code already exists')

  const coupon = await prisma.coupon.create({
    data: {
      code: data.code,
      description: data.description ?? null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUses: data.maxUses ?? null,
      maxUsesPerUser: data.maxUsesPerUser,
      minPurchaseAmount: data.minPurchaseAmount ?? null,
      validFrom: data.validFrom,
      validUntil: data.validUntil ?? null,
      appliesTo: data.appliesTo,
      planFilter: data.planFilter,
      metadata: (data.metadata ?? {}) as object,
      createdBy: adminId,
    },
  })

  logger.info('coupon.created', { couponId: coupon.id, code: coupon.code, adminId })
  return withStatus(coupon)
}

// ─── Admin: Bulk Generate ────────────────────────────────────────────────

export async function bulkCreateCoupons(adminId: string, data: BulkCreateCouponsInput) {
  // Fix #4: Generate all candidate codes first, check existence in single query
  const candidateSet = new Set<string>()
  const maxAttempts = data.count * 3

  for (let attempt = 0; candidateSet.size < maxAttempts && candidateSet.size < data.count * 2; attempt++) {
    candidateSet.add(`${data.prefix}-${generateSuffix()}`)
    if (attempt >= maxAttempts) break
  }

  const candidates = Array.from(candidateSet)

  // Single query to check all candidates at once
  const existingCoupons = await prisma.coupon.findMany({
    where: { code: { in: candidates } },
    select: { code: true },
  })

  const existingCodes = new Set(existingCoupons.map((c) => c.code))
  const codes = candidates.filter((c) => !existingCodes.has(c)).slice(0, data.count)

  if (codes.length < data.count) {
    throw validationError(`Could only generate ${codes.length} unique codes out of ${data.count} requested. Try a different prefix.`)
  }

  // Bulk insert inside a transaction
  const coupons = await prisma.$transaction(
    codes.map((code) =>
      prisma.coupon.create({
        data: {
          code,
          description: `Bulk: ${data.prefix} campaign`,
          discountType: data.discountType,
          discountValue: data.discountValue,
          maxUses: data.maxUses ?? null,
          maxUsesPerUser: data.maxUsesPerUser,
          minPurchaseAmount: null,
          validFrom: data.validFrom,
          validUntil: data.validUntil ?? null,
          appliesTo: data.appliesTo,
          planFilter: data.planFilter,
          metadata: (data.metadata ?? {}) as object,
          createdBy: adminId,
        },
      })
    )
  )

  logger.info('coupon.bulk_created', { count: coupons.length, prefix: data.prefix, adminId })
  return { created: coupons.length, codes }
}

// ─── Admin: List ─────────────────────────────────────────────────────────

export async function listCoupons(query: ListCouponsQuery) {
  const { cursor, limit, status, search } = query

  // Build where clause — push computed status filtering into DB where possible
  const where: Record<string, unknown> = {}
  const now = new Date()

  if (search) {
    where.code = { contains: search.toUpperCase(), mode: 'insensitive' }
  }

  // Fix #8: DB-level filtering for computed statuses instead of post-filter
  if (status === 'DEACTIVATED') {
    where.isActive = false
  } else if (status === 'EXPIRED') {
    where.isActive = true
    where.validUntil = { not: null, lt: now }
  } else if (status === 'SCHEDULED') {
    where.isActive = true
    where.validFrom = { gt: now }
  } else if (status === 'ACTIVE') {
    where.isActive = true
    where.validFrom = { lte: now }
    where.OR = [{ validUntil: null }, { validUntil: { gte: now } }]
    // EXHAUSTED excluded in-memory since it needs maxUses comparison
  } else if (status === 'EXHAUSTED') {
    where.isActive = true
    // Can't fully do this in DB without raw SQL, so over-fetch and filter
  } else if (status) {
    where.isActive = true
  }

  const fetchLimit = status === 'ACTIVE' || status === 'EXHAUSTED' ? limit * 3 : limit + 1

  const coupons = await prisma.coupon.findMany({
    where,
    take: fetchLimit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
  })

  // Apply computed status filter for cases DB can't fully handle
  let filtered = coupons.map(withStatus)
  if (status === 'ACTIVE') {
    filtered = filtered.filter((c) => c.status === 'ACTIVE')
  } else if (status === 'EXHAUSTED') {
    filtered = filtered.filter((c) => c.status === 'EXHAUSTED')
  }

  const hasMore = filtered.length > limit
  const items = filtered.slice(0, limit)
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null

  // Get total for the filter
  const total = await prisma.coupon.count({ where })

  return { items, total, nextCursor }
}

// ─── Admin: Get Detail ───────────────────────────────────────────────────

export async function getCouponDetail(couponId: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    include: {
      redemptions: {
        orderBy: { redeemedAt: 'desc' },
        take: DETAIL_REDEMPTIONS_LIMIT,
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  })

  if (!coupon) throw notFoundError('Coupon')

  const stats = await prisma.couponRedemption.aggregate({
    where: { couponId },
    _count: true,
    _sum: { discountApplied: true },
  })

  return {
    coupon: withStatus(coupon),
    redemptions: coupon.redemptions,
    stats: {
      totalRedeemed: stats._count,
      totalDiscountGiven: stats._sum.discountApplied ?? 0,
    },
  }
}

// ─── Admin: Update ───────────────────────────────────────────────────────

export async function updateCoupon(couponId: string, data: UpdateCouponInput) {
  const existing = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!existing) throw notFoundError('Coupon')

  // Validate percentage cap if changing discountType or value
  const newType = data.discountType ?? existing.discountType
  const newValue = data.discountValue ?? existing.discountValue
  if (newType === 'PERCENTAGE' && newValue > MAX_PERCENTAGE_BASIS_POINTS) {
    throw validationError(PERCENTAGE_CAP_MSG)
  }

  const coupon = await prisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.discountType !== undefined && { discountType: data.discountType }),
      ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
      ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
      ...(data.maxUsesPerUser !== undefined && { maxUsesPerUser: data.maxUsesPerUser }),
      ...(data.minPurchaseAmount !== undefined && { minPurchaseAmount: data.minPurchaseAmount }),
      ...(data.validFrom !== undefined && { validFrom: data.validFrom }),
      ...(data.validUntil !== undefined && { validUntil: data.validUntil }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.appliesTo !== undefined && { appliesTo: data.appliesTo }),
      ...(data.planFilter !== undefined && { planFilter: data.planFilter }),
      ...(data.metadata !== undefined && { metadata: data.metadata as object }),
    },
  })

  logger.info('coupon.updated', { couponId, fields: Object.keys(data) })
  return withStatus(coupon)
}

// ─── Admin: Deactivate (soft delete) ─────────────────────────────────────

export async function deactivateCoupon(couponId: string) {
  const existing = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!existing) throw notFoundError('Coupon')

  await prisma.coupon.update({
    where: { id: couponId },
    data: { isActive: false },
  })

  logger.info('coupon.deactivated', { couponId, code: existing.code })
  return { deactivated: true }
}

// ─── User: Validate ──────────────────────────────────────────────────────

export async function validateCoupon(userId: string, data: ValidateCouponInput, ip?: string) {
  // Fraud: check if user is locked out from too many failed attempts
  if (couponFraudTracker.isLockedOut(userId)) {
    logger.warn('coupon.validate_blocked', { userId, reason: 'lockout', ip })
    return { valid: false, error: { code: 'COUPON_RATE_LIMITED', message: 'Too many failed attempts. Please try again later.' } }
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: data.code } })

  // Don't reveal if code exists — generic error
  if (!coupon) {
    couponFraudTracker.recordFailedValidation(userId, data.code, ip)
    logger.warn('coupon.validate_failed', { userId, code: data.code, reason: 'not_found', ip })
    return { valid: false, error: COUPON_ERRORS.NOT_FOUND }
  }

  const status = computeStatus(coupon)

  if (status !== 'ACTIVE') {
    const errorMap: Record<string, typeof COUPON_ERRORS[keyof typeof COUPON_ERRORS]> = {
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

  // Check plan filter
  if (data.planId && coupon.planFilter.length > 0 && !coupon.planFilter.includes(data.planId)) {
    couponFraudTracker.recordFailedValidation(userId, data.code, ip)
    logger.warn('coupon.validate_failed', { userId, code: data.code, reason: 'plan_mismatch', ip })
    return { valid: false, error: COUPON_ERRORS.PLAN_MISMATCH }
  }

  // Check minPurchaseAmount
  if (coupon.minPurchaseAmount !== null && data.planAmountPaise !== undefined) {
    if (data.planAmountPaise < coupon.minPurchaseAmount) {
      couponFraudTracker.recordFailedValidation(userId, data.code, ip)
      logger.warn('coupon.validate_failed', { userId, code: data.code, reason: 'min_amount', ip })
      return { valid: false, error: COUPON_ERRORS.MIN_AMOUNT }
    }
  }

  // Check per-user usage
  const userRedemptions = await prisma.couponRedemption.count({
    where: { couponId: coupon.id, userId },
  })
  if (userRedemptions >= coupon.maxUsesPerUser) {
    couponFraudTracker.recordFailedValidation(userId, data.code, ip)
    logger.warn('coupon.validate_failed', { userId, code: data.code, reason: 'already_used', ip })
    return { valid: false, error: COUPON_ERRORS.ALREADY_USED }
  }

  // Calculate discount preview using actual plan amount
  const subtotal = data.planAmountPaise ?? 0
  const discountPreview = subtotal > 0 ? calculateDiscount(coupon.discountType, coupon.discountValue, subtotal) : 0

  const message = coupon.discountType === 'PERCENTAGE'
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

// ─── User: Apply ─────────────────────────────────────────────────────────

export async function applyCoupon(userId: string, data: ApplyCouponInput, ip?: string) {
  const coupon = await prisma.coupon.findUnique({ where: { code: data.code } })
  if (!coupon) throw validationError(COUPON_ERRORS.NOT_FOUND.message)

  // Re-validate on apply (coupon may have expired between validate and apply)
  const status = computeStatus(coupon)
  if (status !== 'ACTIVE') {
    const errorKey = status as keyof typeof COUPON_ERRORS
    throw validationError(COUPON_ERRORS[errorKey]?.message ?? 'Coupon is not active')
  }

  // Check plan filter
  if (data.planId && coupon.planFilter.length > 0 && !coupon.planFilter.includes(data.planId)) {
    throw validationError(COUPON_ERRORS.PLAN_MISMATCH.message)
  }

  // Fix #5: Check minPurchaseAmount on apply too
  if (coupon.minPurchaseAmount !== null && data.planAmountPaise !== undefined) {
    if (data.planAmountPaise < coupon.minPurchaseAmount) {
      throw validationError(COUPON_ERRORS.MIN_AMOUNT.message)
    }
  }

  // Fix #2: Atomic per-user guard + global usage in a serialized transaction
  const result = await prisma.$transaction(async (tx) => {
    // Check per-user usage inside transaction
    const userRedemptions = await tx.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    })
    if (userRedemptions >= coupon.maxUsesPerUser) {
      throw validationError(COUPON_ERRORS.ALREADY_USED.message)
    }

    // Atomic usage count increment — race condition prevention
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

    // Fix #1: Calculate actual discount using real plan amount
    const subtotal = data.planAmountPaise ?? 0
    const discountApplied = subtotal > 0 ? calculateDiscount(coupon.discountType, coupon.discountValue, subtotal) : 0

    // Create redemption record with IP for audit trail
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
  }, { isolationLevel: 'Serializable' })

  logger.info('coupon.applied', {
    couponId: coupon.id,
    code: coupon.code,
    userId,
    discountApplied: result.discountApplied,
  })

  // TODO: Link Razorpay offer when credentials available
  const razorpayOfferLinked = false

  return { redemption: result.redemption, razorpayOfferLinked }
}

// ─── User: Remove ────────────────────────────────────────────────────────

export async function removeRedemption(userId: string, redemptionId: string, ip?: string) {
  // Fraud: cycling detection — block users who repeatedly apply/remove coupons
  if (couponFraudTracker.isCycling(userId)) {
    logger.warn('coupon.remove_blocked', { userId, reason: 'cycling', ip })
    throw validationError('Too many coupon changes. Please try again later.')
  }

  const redemption = await prisma.couponRedemption.findUnique({
    where: { id: redemptionId },
  })

  if (!redemption) throw notFoundError('Coupon redemption')
  if (redemption.userId !== userId) throw notFoundError('Coupon redemption')

  // Track remove for cycling detection
  couponFraudTracker.recordRemove(userId, ip)

  // Guard against negative usageCount with updateMany + gt check
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

// ─── Pure Helpers ────────────────────────────────────────────────────────

/** Calculate discount amount in paise */
function calculateDiscount(
  discountType: string,
  discountValue: number,
  subtotalPaise: number
): number {
  if (discountType === 'PERCENTAGE') {
    // discountValue is basis points (2000 = 20%)
    return Math.round((subtotalPaise * discountValue) / 10000)
  }
  // FIXED — discountValue is paise, cap at subtotal
  return Math.min(discountValue, subtotalPaise)
}
