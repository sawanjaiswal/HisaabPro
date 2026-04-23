/**
 * Coupon helpers — pure functions and constants.
 * No DB access, no side effects.
 */

import crypto from 'node:crypto'
import { SUFFIX_CHARS, SUFFIX_LENGTH } from '../../config/coupon.config.js'
export { MAX_PERCENTAGE_BASIS_POINTS } from '../../config/coupon.config.js'
import type { CouponStatus } from '../../config/coupon.config.js'

// ─── Status ───────────────────────────────────────────────────────────────

/** Derive coupon status at runtime — never stored in DB */
export function computeStatus(coupon: {
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
export function withStatus<
  T extends {
    isActive: boolean
    validFrom: Date
    validUntil: Date | null
    maxUses: number | null
    usageCount: number
  },
>(coupon: T): T & { status: CouponStatus } {
  return { ...coupon, status: computeStatus(coupon) }
}

// ─── Code generation ──────────────────────────────────────────────────────

/** Generate a random suffix for bulk codes (no ambiguous chars) */
export function generateSuffix(length = SUFFIX_LENGTH): string {
  let suffix = ''
  for (let i = 0; i < length; i++) {
    suffix += SUFFIX_CHARS[crypto.randomInt(SUFFIX_CHARS.length)]
  }
  return suffix
}

// ─── Discount calculation ─────────────────────────────────────────────────

/** Calculate discount amount in paise */
export function calculateDiscount(
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

// ─── Error constants ──────────────────────────────────────────────────────

/**
 * Coupon validation error codes — per PRD §4.
 * These are returned to the client so they can show specific messages.
 */
export const COUPON_ERRORS = {
  NOT_FOUND: { code: 'COUPON_NOT_FOUND', message: 'Invalid coupon code' },
  EXPIRED: { code: 'COUPON_EXPIRED', message: 'This coupon has expired' },
  EXHAUSTED: { code: 'COUPON_EXHAUSTED', message: 'This coupon has been fully redeemed' },
  ALREADY_USED: { code: 'COUPON_ALREADY_USED', message: 'You have already used this coupon' },
  INACTIVE: { code: 'COUPON_INACTIVE', message: 'This coupon is not currently active' },
  NOT_STARTED: { code: 'COUPON_NOT_STARTED', message: 'This coupon is not yet active' },
  PLAN_MISMATCH: {
    code: 'COUPON_PLAN_MISMATCH',
    message: 'This coupon does not apply to your selected plan',
  },
  MIN_AMOUNT: {
    code: 'COUPON_MIN_AMOUNT',
    message: 'Your order does not meet the minimum amount for this coupon',
  },
} as const

