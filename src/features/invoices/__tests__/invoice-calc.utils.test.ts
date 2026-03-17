import { describe, it, expect } from 'vitest'
import {
  calculateLineTotal,
  calculateDiscount,
  calculateChargeAmount,
  calculateRoundOff,
  calculateGrandTotal,
} from '../invoice-calc.utils'

// ─── Discount calculation ────────────────────────────────────────────────────

describe('calculateDiscount', () => {
  it('returns 0 for zero discount value', () => {
    expect(calculateDiscount(100000, 'AMOUNT', 0)).toBe(0)
  })

  it('returns 0 for negative discount value', () => {
    expect(calculateDiscount(100000, 'PERCENTAGE', -5)).toBe(0)
  })

  it('calculates flat AMOUNT discount', () => {
    expect(calculateDiscount(100000, 'AMOUNT', 5000)).toBe(5000)
  })

  it('caps AMOUNT discount at subtotal', () => {
    expect(calculateDiscount(100000, 'AMOUNT', 200000)).toBe(100000)
  })

  it('calculates PERCENTAGE discount', () => {
    expect(calculateDiscount(100000, 'PERCENTAGE', 10)).toBe(10000)
  })

  it('caps PERCENTAGE at 100%', () => {
    expect(calculateDiscount(100000, 'PERCENTAGE', 150)).toBe(100000)
  })
})

// ─── Line total ──────────────────────────────────────────────────────────────

describe('calculateLineTotal', () => {
  it('calculates line total with AMOUNT discount', () => {
    const result = calculateLineTotal(2, 800000, 'AMOUNT', 50000)
    expect(result.lineTotal).toBe(1550000)
    expect(result.discountAmount).toBe(50000)
  })

  it('calculates line total with PERCENTAGE discount', () => {
    const result = calculateLineTotal(3, 100000, 'PERCENTAGE', 10)
    expect(result.lineTotal).toBe(270000)
    expect(result.discountAmount).toBe(30000)
  })

  it('handles zero quantity', () => {
    const result = calculateLineTotal(0, 100000, 'AMOUNT', 0)
    expect(result.lineTotal).toBe(0)
    expect(result.discountAmount).toBe(0)
  })
})

// ─── Charge calculation ──────────────────────────────────────────────────────

describe('calculateChargeAmount', () => {
  it('returns 0 for zero charge value', () => {
    expect(calculateChargeAmount(100000, 'FIXED', 0)).toBe(0)
  })

  it('returns fixed charge as-is', () => {
    expect(calculateChargeAmount(100000, 'FIXED', 5000)).toBe(5000)
  })

  it('calculates percentage charge', () => {
    expect(calculateChargeAmount(100000, 'PERCENTAGE', 5)).toBe(5000)
  })
})

// ─── Round-off ───────────────────────────────────────────────────────────────

describe('calculateRoundOff', () => {
  it('returns 0 for NONE', () => {
    expect(calculateRoundOff(15175, 'NONE')).toBe(0)
  })

  it('rounds to nearest 10 paise', () => {
    expect(calculateRoundOff(15175, 'NEAREST_010')).toBe(5)
  })

  it('rounds to nearest 50 paise', () => {
    expect(calculateRoundOff(15175, 'NEAREST_050')).toBe(25)
  })

  it('rounds to nearest rupee (100 paise)', () => {
    // 15175 / 100 = 151.75 → rounds to 152 × 100 = 15200 → delta = +25
    expect(calculateRoundOff(15175, 'NEAREST_1')).toBe(25)
  })

  it('returns 0 when already rounded', () => {
    expect(calculateRoundOff(15000, 'NEAREST_1')).toBe(0)
  })
})

// ─── Grand total ─────────────────────────────────────────────────────────────

describe('calculateGrandTotal', () => {
  it('calculates correctly', () => {
    expect(calculateGrandTotal(100000, 10000, 5000, -75)).toBe(94925)
  })

  it('clamps to 0 when discount exceeds subtotal', () => {
    expect(calculateGrandTotal(10000, 50000, 0, 0)).toBe(0)
  })
})
