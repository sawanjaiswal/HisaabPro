/**
 * Coupon / Discount Code — Admin types
 * Feature #96
 *
 * Shared enums (DiscountType, CouponAppliesTo, CouponStatus) imported from
 * src/types/coupon.types.ts — the single source of truth.
 */

// Re-export shared types so admin consumers don't need to know the shared path
export type { DiscountType, CouponAppliesTo, CouponStatus, CouponValidationResult, CouponApplyResult } from '@/types/coupon.types'
import type { DiscountType, CouponAppliesTo, CouponStatus } from '@/types/coupon.types'

export interface Coupon {
  id: string
  code: string
  description: string | null
  discountType: DiscountType
  discountValue: number // basis points for %, paise for fixed
  maxUses: number | null
  usageCount: number
  maxUsesPerUser: number
  minPurchaseAmount: number | null
  validFrom: string
  validUntil: string | null
  isActive: boolean
  appliesTo: CouponAppliesTo
  planFilter: string[]
  razorpayOfferId: string | null
  metadata: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
  status: CouponStatus
}

export interface CouponRedemption {
  id: string
  couponId: string
  userId: string
  discountApplied: number // paise
  planId: string | null
  razorpaySubscriptionId: string | null
  redeemedAt: string
  metadata: Record<string, unknown>
  user: { id: string; name: string | null; phone: string }
}

export interface CouponDetail {
  coupon: Coupon
  redemptions: CouponRedemption[]
  stats: {
    totalRedeemed: number
    totalDiscountGiven: number // paise
  }
}

export interface CouponListResult {
  items: Coupon[]
  total: number
  nextCursor: string | null
}

export interface BulkCreateResult {
  created: number
  codes: string[]
}

export interface CreateCouponInput {
  code: string
  description?: string
  discountType: DiscountType
  discountValue: number
  maxUses?: number | null
  maxUsesPerUser?: number
  minPurchaseAmount?: number | null
  validFrom: string
  validUntil?: string | null
  appliesTo: CouponAppliesTo
  planFilter?: string[]
  metadata?: Record<string, unknown>
}

export interface UpdateCouponInput {
  description?: string
  discountType?: DiscountType
  discountValue?: number
  maxUses?: number | null
  maxUsesPerUser?: number
  minPurchaseAmount?: number | null
  validFrom?: string
  validUntil?: string | null
  isActive?: boolean
  appliesTo?: CouponAppliesTo
  planFilter?: string[]
  metadata?: Record<string, unknown>
}

export interface BulkCreateInput {
  prefix: string
  count: number
  discountType: DiscountType
  discountValue: number
  maxUses?: number | null
  maxUsesPerUser?: number
  validFrom: string
  validUntil?: string | null
  appliesTo: CouponAppliesTo
  planFilter?: string[]
  metadata?: Record<string, unknown>
}
