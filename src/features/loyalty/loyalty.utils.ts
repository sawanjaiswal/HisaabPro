/**
 * Loyalty #125 — Pure helpers.
 *
 * Math discipline:
 *   - Cross-multiplies between points and paise use BigInt to match the server
 *     (server/src/services/pos/pos.validators.ts — validateLoyaltyOnCheckout).
 *     This protects whale-tenant pairs (points * redemptionPaisePerUnit) from
 *     IEEE-754 rounding before the server even sees them.
 *   - Rate conversions stay in JS numbers (bps are small ints).
 */

import type { LoyaltyProgramDTO } from './loyalty.types'

// ─── Display helpers ────────────────────────────────────────────────────────

/** Indian-format integer with thousands separators — "1,23,456" */
export function formatPoints(points: number): string {
  const n = Math.max(0, Math.round(points))
  return new Intl.NumberFormat('en-IN').format(n)
}

/** Convert bps to a human-readable percentage string, e.g. 125 → "1.25%" */
export function bpsToPercentLabel(bps: number): string {
  const pct = bps / 100
  // Trim trailing zeros: 1.00 → 1, 1.25 → 1.25
  return `${pct.toFixed(2).replace(/\.?0+$/, '')}%`
}

/** Convert a percent string ("1.25") to bps integer (125). NaN on invalid. */
export function percentToBps(input: string | number): number {
  const n = typeof input === 'string' ? parseFloat(input) : input
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100)
}

// ─── Redemption math (BigInt — matches server) ─────────────────────────────

/**
 * Maximum points the user can redeem against `billPaise`, snapped DOWN to
 * the program's `redemptionUnit`. Caller is expected to clamp this further
 * against `availablePoints` (current balance).
 *
 *   maxPoints(billPaise, program, availablePoints)
 *     = floor( min(availablePoints, billPaise * redemptionUnit / redemptionPaisePerUnit) / redemptionUnit )
 *       * redemptionUnit
 */
export function maxRedeemPoints(
  billPaise: number,
  availablePoints: number,
  program: Pick<LoyaltyProgramDTO, 'redemptionUnit' | 'redemptionPaisePerUnit'>
): number {
  if (billPaise <= 0 || availablePoints <= 0) return 0
  if (program.redemptionPaisePerUnit <= 0 || program.redemptionUnit <= 0) return 0

  // points-equiv of the entire bill, BigInt to avoid overflow
  const billPointsEquivBI =
    (BigInt(billPaise) * BigInt(program.redemptionUnit)) /
    BigInt(program.redemptionPaisePerUnit)
  const billPointsEquiv = Number(billPointsEquivBI)

  const usable = Math.min(availablePoints, billPointsEquiv)
  // Snap DOWN to redemptionUnit boundary
  const units = Math.floor(usable / program.redemptionUnit)
  return units * program.redemptionUnit
}

/**
 * Inverse: given `points`, what's the paise discount the server will accept?
 * BigInt cross-multiply so the value matches exactly what
 * `validateLoyaltyOnCheckout` computes server-side.
 *
 *   paise = floor(points * redemptionPaisePerUnit / redemptionUnit)
 */
export function pointsToPaise(
  points: number,
  program: Pick<LoyaltyProgramDTO, 'redemptionUnit' | 'redemptionPaisePerUnit'>
): number {
  if (points <= 0) return 0
  if (program.redemptionUnit <= 0) return 0
  return Number(
    (BigInt(points) * BigInt(program.redemptionPaisePerUnit)) /
      BigInt(program.redemptionUnit)
  )
}

// ─── Expiry phrasing ────────────────────────────────────────────────────────

/**
 * Pure transformer — UI maps the returned `{months}` to a translation key.
 * Returns `null` if program disables expiry.
 */
export function expirySummary(
  expiryMonths: number | null
): { months: number } | null {
  if (expiryMonths == null) return null
  return { months: expiryMonths }
}

// ─── Form validation ────────────────────────────────────────────────────────

import {
  ACCRUAL_RATE_MAX_BPS,
  EXPIRY_MONTHS_MAX,
  EXPIRY_MONTHS_MIN,
} from './loyalty.constants'

export interface ProgramFormErrors {
  accrualRateBps?: string
  accrualMinSpendPaise?: string
  redemptionUnit?: string
  redemptionPaisePerUnit?: string
  expiryMonths?: string
}

/** Returns an error map (empty object = valid). t-key returned, NOT english. */
export function validateProgramInput(input: {
  accrualRateBps: number
  accrualMinSpendPaise: number
  redemptionUnit: number
  redemptionPaisePerUnit: number
  expiryMonths: number | null
}): ProgramFormErrors {
  const errors: ProgramFormErrors = {}

  if (!Number.isFinite(input.accrualRateBps) || input.accrualRateBps < 0)
    errors.accrualRateBps = 'loyaltyErrorRateNegative'
  if (input.accrualRateBps > ACCRUAL_RATE_MAX_BPS)
    errors.accrualRateBps = 'loyaltyErrorRateMax'

  if (!Number.isFinite(input.accrualMinSpendPaise) || input.accrualMinSpendPaise < 0)
    errors.accrualMinSpendPaise = 'loyaltyErrorMinSpendNegative'

  if (!Number.isInteger(input.redemptionUnit) || input.redemptionUnit < 1)
    errors.redemptionUnit = 'loyaltyErrorRedemptionUnit'

  if (!Number.isInteger(input.redemptionPaisePerUnit) || input.redemptionPaisePerUnit < 0)
    errors.redemptionPaisePerUnit = 'loyaltyErrorRedemptionPaise'

  if (input.expiryMonths !== null) {
    if (
      !Number.isInteger(input.expiryMonths) ||
      input.expiryMonths < EXPIRY_MONTHS_MIN ||
      input.expiryMonths > EXPIRY_MONTHS_MAX
    ) {
      errors.expiryMonths = 'loyaltyErrorExpiryRange'
    }
  }

  return errors
}
