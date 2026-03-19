/**
 * Coupon — Pure utility functions
 * Feature #96
 */

import type { Coupon, DiscountType } from './coupon.types'

/** Format discount for display: "20%" or "₹59.80" */
export function formatDiscount(type: DiscountType, value: number): string {
  if (type === 'PERCENTAGE') {
    return `${value / 100}%`
  }
  // Fixed — value is in paise
  return `₹${(value / 100).toFixed(2)}`
}

/** Format discount value as a readable string including type */
export function formatDiscountLabel(type: DiscountType, value: number): string {
  if (type === 'PERCENTAGE') {
    return `${value / 100}% off`
  }
  return `₹${(value / 100).toFixed(2)} off`
}

/** Format usage count as "5 / 100" or "5 / ∞" */
export function formatUsage(used: number, max: number | null): string {
  return `${used} / ${max ?? '∞'}`
}

/** Check if a coupon list is empty */
export function isCouponListEmpty(items: Coupon[]): boolean {
  return items.length === 0
}

/** Format paise to rupees string */
export function paiseToRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`
}

/** Format date for display */
export function formatCouponDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Format date-time for display */
export function formatCouponDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
