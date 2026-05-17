/**
 * Test 12.11 — BigInt cross-multiply for whale-tenant overflow safety.
 *
 * Security audit S1: a tenant with INT_MAX-sized point balances can hit
 * Number-overflow on plain (a*b)/c math. We assert that the loyalty math
 * helpers stay exact for the boundary values that would overflow if the
 * intermediate product were stored in a JS Number.
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.1 (accrual rule),
 * §3.2 (redemption rule). loyalty.utils.computePointsEarned +
 * computeRedemptionAmountPaise are the SSOTs.
 */

import { describe, it, expect } from 'vitest'
import {
  computePointsEarned,
  computeRedemptionAmountPaise,
  isRedemptionExact,
} from '../services/loyalty/loyalty.utils.js'

describe('Loyalty BigInt math (test 12.11)', () => {
  it('computePointsEarned: small input rounds-down correctly', () => {
    // 99 paise × 100 bps / 10000 = 0.99 → floor → 0
    expect(computePointsEarned(99, 100)).toBe(0)
    // 100 paise × 100 bps / 10000 = 1.0 → 1
    expect(computePointsEarned(100, 100)).toBe(1)
    // 10_000 paise × 100 bps / 10000 = 100
    expect(computePointsEarned(10_000, 100)).toBe(100)
  })

  it('computePointsEarned: whale subtotal stays exact in BigInt', () => {
    // 1 trillion paise (Rs 10 crore) at 5% = 50 lakh points.
    const subtotal = 1_000_000_000_000 // 10^12
    const bps = 500 // 5%
    expect(computePointsEarned(subtotal, bps)).toBe(50_000_000_000)
  })

  it('computePointsEarned: MAX_SAFE × 10000 bps without overflow', () => {
    // (Number.MAX_SAFE_INTEGER × 10000 / 10000) = Number.MAX_SAFE_INTEGER.
    // Plain (a*b)/c would overflow into double-precision and lose digits.
    const safe = Number.MAX_SAFE_INTEGER
    expect(computePointsEarned(safe, 10_000)).toBe(safe)
  })

  it('computePointsEarned: rejects negative subtotal', () => {
    expect(() => computePointsEarned(-1, 100)).toThrow(TypeError)
  })

  it('computePointsEarned: rejects out-of-bound bps', () => {
    expect(() => computePointsEarned(100, -1)).toThrow(TypeError)
    expect(() => computePointsEarned(100, 10_001)).toThrow(TypeError)
  })

  it('computeRedemptionAmountPaise: 7 pts at unit=2, ppu=10 → 35 (exact)', () => {
    // floor(7 × 10 / 2) = 35 paise discount
    expect(computeRedemptionAmountPaise(7, 2, 10)).toBe(35)
  })

  it('computeRedemptionAmountPaise: floors when result is fractional', () => {
    // floor(7 × 10 / 3) = floor(23.33) = 23
    expect(computeRedemptionAmountPaise(7, 3, 10)).toBe(23)
  })

  it('computeRedemptionAmountPaise: divide-by-zero rejected', () => {
    expect(() => computeRedemptionAmountPaise(7, 0, 10)).toThrow(/redemptionUnit/)
  })

  it('isRedemptionExact: tampered amount detected', () => {
    // 100 pts × 100 paise/unit / 1 unit = 10_000 paise. Anything else = mismatch.
    expect(isRedemptionExact(100, 1, 100, 10_000)).toBe(true)
    expect(isRedemptionExact(100, 1, 100, 9_999)).toBe(false)
    expect(isRedemptionExact(100, 1, 100, 10_001)).toBe(false)
  })
})
