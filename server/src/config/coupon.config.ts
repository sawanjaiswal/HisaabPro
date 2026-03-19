/**
 * Coupon System — Configuration constants (SSOT)
 * Feature #96
 *
 * All coupon validation limits, business rules, and magic numbers
 * live here. Backend schemas and services import from this file.
 */

// ─── Code Validation ─────────────────────────────────────────────────────

export const CODE_MIN_LENGTH = 4
export const CODE_MAX_LENGTH = 20
export const CODE_REGEX = /^[A-Z0-9-]+$/
export const CODE_REGEX_MSG = 'Code must be uppercase alphanumeric + hyphens only'

// ─── Prefix Validation (Bulk) ────────────────────────────────────────────

export const PREFIX_MIN_LENGTH = 2
export const PREFIX_MAX_LENGTH = 16
export const PREFIX_REGEX = /^[A-Z0-9]+$/
export const PREFIX_REGEX_MSG = 'Prefix must be uppercase alphanumeric'

// ─── Discount Limits ─────────────────────────────────────────────────────

/** 10000 basis points = 100%. Percentage discounts cannot exceed this. */
export const MAX_PERCENTAGE_BASIS_POINTS = 10_000
export const PERCENTAGE_CAP_MSG = 'Percentage discount cannot exceed 100% (10000 basis points)'

// ─── Bulk Generation ─────────────────────────────────────────────────────

export const BULK_MAX_COUNT = 500

/** Characters used in generated suffix (no ambiguous I/O/0/1) */
export const SUFFIX_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Entropy: 6 chars from 31-char alphabet = 31^6 ≈ 887M combos per prefix */
export const SUFFIX_LENGTH = 6

// ─── Pagination ──────────────────────────────────────────────────────────

export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 100

/** Max redemptions shown on detail page */
export const DETAIL_REDEMPTIONS_LIMIT = 50

// ─── Text Limits ─────────────────────────────────────────────────────────

export const DESCRIPTION_MAX_LENGTH = 500
export const SEARCH_MAX_LENGTH = 100

// ─── Coupon Status Values ────────────────────────────────────────────────

export const COUPON_STATUSES = ['ACTIVE', 'EXPIRED', 'EXHAUSTED', 'DEACTIVATED', 'SCHEDULED'] as const
export type CouponStatus = (typeof COUPON_STATUSES)[number]

// ─── Fraud Prevention ───────────────────────────────────────────────────

/** Window for tracking failed validation attempts (ms) — 15 minutes */
export const FRAUD_WINDOW_MS = 15 * 60 * 1000

/** Max failed validations before user is locked out of coupon validation */
export const FRAUD_MAX_FAILED_ATTEMPTS = 10

/** Distinct codes threshold — log warning when user tries this many different codes */
export const FRAUD_VELOCITY_THRESHOLD = 5

/** Max coupon removes per user in fraud window — cycling detection */
export const FRAUD_MAX_REMOVES = 5
