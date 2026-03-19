/**
 * Coupon — Shared types used by admin + checkout features
 * Feature #96
 *
 * SSOT for coupon enums and user-facing result types.
 * Admin-specific types (Coupon, CouponDetail) stay in features/admin/coupons/coupon.types.ts.
 */

export type DiscountType = 'PERCENTAGE' | 'FIXED'
export type CouponAppliesTo = 'FIRST_CYCLE' | 'ALL_CYCLES' | 'ONE_TIME'
export type CouponStatus = 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED' | 'DEACTIVATED' | 'SCHEDULED'

/** Returned by POST /coupons/validate */
export interface CouponValidationResult {
  valid: boolean
  code?: string
  discountType?: DiscountType
  discountValue?: number
  discountPreview?: number // paise
  appliesTo?: CouponAppliesTo
  message?: string
  error?: { code: string; message: string }
}

/** Returned by POST /coupons/apply */
export interface CouponApplyResult {
  redemption: {
    id: string
    couponId: string
    discountApplied: number
  }
  razorpayOfferLinked: boolean
}
