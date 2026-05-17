/**
 * Loyalty #125 — Pure math helpers for accrual + redemption.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.1 (accrual rule),
 * §3.2 (redemption rule). Security audit S1 (BigInt cross-mult to prevent
 * Number.MAX_SAFE_INTEGER overflow on whale tenants).
 *
 * Rules:
 *  - All inputs/outputs are integer (paise + bps + points).
 *  - No external I/O — purely deterministic. Service callers compose these
 *    with the DB write.
 *  - Whale safety: subtotal × bps stays in BigInt until the final divide,
 *    then narrows back to Number. Even at PInt64.MAX subtotal × 10000bps we
 *    never overflow JS Number — the BigInt path keeps full precision.
 *  - We FLOOR all results (architecture §3.1: "round-down so a tenant never
 *    accrues / redeems half a point").
 */

import {
  ACCRUAL_RATE_MAX_BPS,
  ACCRUAL_RATE_MIN_BPS,
  WALK_IN_PARTY_SENTINEL,
} from './loyalty.constants.js'

// ─── Internal guards (throw on programmer error, NOT user input) ───────────

function assertNonNegativeInt(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer (got ${value})`)
  }
}

function assertRateBpsInBounds(value: number): void {
  if (!Number.isInteger(value) || value < ACCRUAL_RATE_MIN_BPS || value > ACCRUAL_RATE_MAX_BPS) {
    throw new TypeError(
      `accrualRateBps out of bounds [${ACCRUAL_RATE_MIN_BPS}, ${ACCRUAL_RATE_MAX_BPS}] (got ${value})`
    )
  }
}

// ─── Accrual ────────────────────────────────────────────────────────────────

/**
 * Compute points earned from a POS-sale line subtotal.
 *
 * Formula (architecture §3.1):
 *   pointsEarned = floor(subtotalPaise × accrualRateBps / 10000)
 *
 * BigInt cross-multiply guarantees no precision loss even when:
 *   subtotalPaise = 9_007_199_254_740_991 (Number.MAX_SAFE_INTEGER)
 *   accrualRateBps = 10000
 * which would overflow `subtotalPaise * accrualRateBps` in plain Number.
 *
 * @param subtotalPaise Line subtotal AFTER discount, BEFORE tax (paise, int).
 * @param accrualRateBps Program rate in basis points (0-10000, int).
 * @returns Floored integer points. Returns 0 when either input is 0.
 */
export function computePointsEarned(subtotalPaise: number, accrualRateBps: number): number {
  assertNonNegativeInt('subtotalPaise', subtotalPaise)
  assertRateBpsInBounds(accrualRateBps)

  if (subtotalPaise === 0 || accrualRateBps === 0) return 0

  // BigInt cross-multiply — never lose precision regardless of magnitude.
  const num = BigInt(subtotalPaise) * BigInt(accrualRateBps)
  const denom = BigInt(10_000)
  const points = num / denom // BigInt floor division for non-negative operands

  // Narrow back to Number — callers persist as INTEGER column.
  // Safe because: even subtotal=1e12 × 10000 / 10000 = 1e12 < MAX_SAFE_INTEGER.
  return Number(points)
}

// ─── Redemption ─────────────────────────────────────────────────────────────

/**
 * Compute paise discount delivered by burning N points.
 *
 * Formula (architecture §3.2):
 *   amountPaise = floor(pointsToRedeem × redemptionPaisePerUnit / redemptionUnit)
 *
 * Same BigInt safety as accrual. Result floors so the merchant is never
 * shorted (we round in their favor — a 7-point redemption at "10 paise/2 pts"
 * yields 30, not 35).
 *
 * @returns Floored integer paise discount.
 */
export function computeRedemptionAmountPaise(
  pointsToRedeem: number,
  redemptionUnit: number,
  redemptionPaisePerUnit: number
): number {
  assertNonNegativeInt('pointsToRedeem', pointsToRedeem)
  assertNonNegativeInt('redemptionUnit', redemptionUnit)
  assertNonNegativeInt('redemptionPaisePerUnit', redemptionPaisePerUnit)

  if (redemptionUnit === 0) {
    throw new TypeError('redemptionUnit must be > 0 (cannot divide by zero)')
  }
  if (pointsToRedeem === 0 || redemptionPaisePerUnit === 0) return 0

  const num = BigInt(pointsToRedeem) * BigInt(redemptionPaisePerUnit)
  const denom = BigInt(redemptionUnit)
  return Number(num / denom)
}

/**
 * Check if a redemption request is "exactly representable" — i.e. the
 * service-supplied `amountPaise` mirrors what we'd compute from the points.
 * Used by accrual route to reject tampered client redemption payloads.
 */
export function isRedemptionExact(
  pointsToRedeem: number,
  redemptionUnit: number,
  redemptionPaisePerUnit: number,
  claimedAmountPaise: number
): boolean {
  const expected = computeRedemptionAmountPaise(
    pointsToRedeem,
    redemptionUnit,
    redemptionPaisePerUnit
  )
  return expected === claimedAmountPaise
}

// ─── Sentinel helpers ──────────────────────────────────────────────────────

/** Walk-in parties are excluded from accrual (architecture §3.1 last bullet). */
export function isWalkInParty(partyId: string): boolean {
  return partyId === WALK_IN_PARTY_SENTINEL
}
