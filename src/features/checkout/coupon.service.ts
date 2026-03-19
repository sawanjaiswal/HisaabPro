/**
 * Coupon — User-facing API service for checkout
 * Feature #96
 */

import { api } from '@/lib/api'
import type { CouponValidationResult, CouponApplyResult } from './coupon.types'

export async function validateCouponCode(
  code: string,
  planId?: string,
  planAmountPaise?: number,
  signal?: AbortSignal
): Promise<CouponValidationResult> {
  return api<CouponValidationResult>('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code, planId, planAmountPaise }),
    signal,
  })
}

export async function applyCouponCode(
  code: string,
  planId?: string,
  planAmountPaise?: number,
  razorpaySubscriptionId?: string,
  signal?: AbortSignal
): Promise<CouponApplyResult> {
  return api<CouponApplyResult>('/coupons/apply', {
    method: 'POST',
    body: JSON.stringify({ code, planId, planAmountPaise, razorpaySubscriptionId }),
    signal,
  })
}

export async function removeCouponCode(
  redemptionId: string,
  signal?: AbortSignal
): Promise<{ removed: boolean }> {
  return api<{ removed: boolean }>('/coupons/remove', {
    method: 'DELETE',
    body: JSON.stringify({ redemptionId }),
    signal,
  })
}
