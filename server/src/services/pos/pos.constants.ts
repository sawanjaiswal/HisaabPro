/**
 * POS Checkout — Shared Constants
 * Single source of truth for limits, tolerances, and TTLs.
 */

/** Hard cap on line items per POS sale. Prevents payload abuse. */
export const MAX_ITEMS_PER_SALE = 200

/**
 * Maximum acceptable drift (paise) between client-reported grand total
 * and server-calculated grand total. Drift > this → 400 TOTAL_MISMATCH.
 */
export const TOTAL_DRIFT_TOLERANCE_PAISE = 100

/** How long an idempotency key is retained before it can be replayed (ms). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Default window (hours) in which a POS sale can be voided.
 * Overridden per-business by PosSetting.voidWindowHours.
 */
export const DEFAULT_VOID_WINDOW_HOURS = 24

/** Maximum allowed discount in basis points (100 % = 10 000 bps). */
export const MAX_DISCOUNT_BPS = 10_000

/** Minimum positive payment amount that counts towards the order total (paise). */
export const MIN_PAYMENT_AMOUNT_PAISE = 1

/** Supported payment modes (lowercase, matches paymentBreakdown JSON).
 *
 * Epic D PR3 (M2 / S3): `loyalty_redemption` is lowercase per wire-format
 * audit. POS routes gate it behind `loyalty.redeem` via posCheckoutAuth.
 */
export const PAYMENT_MODES = [
  'cash',
  'upi',
  'card',
  'bank_transfer',
  'other',
  'loyalty_redemption',
] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

/** Document type stored on the Document row. */
export const POS_DOCUMENT_TYPE = 'POS_SALE' as const

/** StockMovement type used for POS sales. */
export const POS_STOCK_MOVEMENT_TYPE = 'SALE' as const

/** referenceType stored on StockMovement rows created by POS checkout. */
export const POS_STOCK_REFERENCE_TYPE = 'POS_SALE' as const

/** PosSaleEvent type for a newly created sale. */
export const POS_EVENT_CREATED = 'CREATED' as const
