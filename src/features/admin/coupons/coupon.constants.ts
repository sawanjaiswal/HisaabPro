/**
 * Coupon — Constants & config (FE SSOT)
 * Feature #96
 *
 * Validation limits here MUST match server/src/config/coupon.config.ts.
 * Labels and colors are FE-only concerns.
 */

import type { CouponStatus, DiscountType, CouponAppliesTo } from './coupon.types'

// ─── Labels ──────────────────────────────────────────────────────────────

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Percentage',
  FIXED: 'Fixed Amount',
}

export const APPLIES_TO_LABELS: Record<CouponAppliesTo, string> = {
  FIRST_CYCLE: 'First Cycle Only',
  ALL_CYCLES: 'All Cycles',
  ONE_TIME: 'One-Time',
}

export const STATUS_LABELS: Record<CouponStatus, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  EXHAUSTED: 'Exhausted',
  DEACTIVATED: 'Deactivated',
  SCHEDULED: 'Scheduled',
}

export const STATUS_COLORS: Record<CouponStatus, string> = {
  ACTIVE: 'var(--color-success)',
  EXPIRED: 'var(--color-text-muted)',
  EXHAUSTED: 'var(--color-warning)',
  DEACTIVATED: 'var(--color-error)',
  SCHEDULED: 'var(--color-info)',
}

// ─── Validation Limits (must match BE coupon.config.ts) ──────────────────

export const CODE_MIN_LENGTH = 4
export const CODE_MAX_LENGTH = 20
export const CODE_PATTERN = /^[A-Z0-9-]+$/
export const MAX_PERCENTAGE_BASIS_POINTS = 10_000
export const PERCENTAGE_CAP_MSG = 'Percentage cannot exceed 100% (10000 basis points)'
export const MAX_BULK_COUNT = 500
export const PREFIX_MIN_LENGTH = 2
export const PREFIX_MAX_LENGTH = 16
export const DEFAULT_PAGE_SIZE = 20
