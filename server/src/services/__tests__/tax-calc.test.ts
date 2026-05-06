/**
 * Server-side tax-calc.ts unit tests
 * Mirrors the vectors in src/features/tax/__tests__/tax-calc.parity.test.ts.
 * All amounts in PAISE. Rates in BASIS POINTS.
 */

import { describe, it, expect } from 'vitest'
import {
  isInterState,
  calculateLineTax,
  calculateDocumentTax,
  backCalculateInclusive,
  applyRcmFlag,
  calculateCompositionTotals,
} from '../tax-calc.js'
import type { TaxLineInput } from '../tax-calc.js'

// ─── Shared fixture ───────────────────────────────────────────────────────────

const LINE_10000_18PCT: TaxLineInput = {
  lineTotal: 10_000,
  gstRate: 1800,
  cessRate: 0,
  cessType: 'PERCENTAGE',
  quantity: 1,
}

// ─── isInterState ─────────────────────────────────────────────────────────────

describe('isInterState', () => {
  it('returns false when either code is null', () => {
    expect(isInterState(null, '27')).toBe(false)
    expect(isInterState('29', null)).toBe(false)
    expect(isInterState(null, null)).toBe(false)
  })

  it('returns false for same state', () => {
    expect(isInterState('29', '29')).toBe(false)
  })

  it('returns true for different states', () => {
    expect(isInterState('29', '27')).toBe(true)
  })
})

// ─── Vector 1: Intra-state 18% EXCLUSIVE ─────────────────────────────────────

describe('Vector 1 — Intra-state 18% EXCLUSIVE', () => {
  it('CGST=900, SGST=900, IGST=0, totalTax=1800', () => {
    const r = calculateLineTax(LINE_10000_18PCT, false)
    expect(r.cgstAmount).toBe(900)
    expect(r.sgstAmount).toBe(900)
    expect(r.igstAmount).toBe(0)
    expect(r.totalTax).toBe(1800)
    expect(r.taxableValue).toBe(10_000)
    expect(r.cgstRate).toBe(900)
    expect(r.sgstRate).toBe(900)
    expect(r.igstRate).toBe(0)
  })

  it('document-level totals match', () => {
    const doc = calculateDocumentTax([LINE_10000_18PCT], false)
    expect(doc.totalCgst).toBe(900)
    expect(doc.totalSgst).toBe(900)
    expect(doc.totalIgst).toBe(0)
    expect(doc.totalTax).toBe(1800)
    expect(doc.totalTaxableValue).toBe(10_000)
    expect(doc.lineResults).toHaveLength(1)
  })
})

// ─── Vector 2: Inter-state 18% EXCLUSIVE ─────────────────────────────────────

describe('Vector 2 — Inter-state 18% EXCLUSIVE', () => {
  it('IGST=1800, CGST=0, SGST=0', () => {
    const r = calculateLineTax(LINE_10000_18PCT, true)
    expect(r.igstAmount).toBe(1800)
    expect(r.cgstAmount).toBe(0)
    expect(r.sgstAmount).toBe(0)
    expect(r.totalTax).toBe(1800)
  })

  it('document-level inter-state totals', () => {
    const doc = calculateDocumentTax([LINE_10000_18PCT], true)
    expect(doc.totalIgst).toBe(1800)
    expect(doc.totalCgst).toBe(0)
    expect(doc.totalSgst).toBe(0)
    expect(doc.totalTax).toBe(1800)
  })
})

// ─── Vector 3: Composition scheme ────────────────────────────────────────────

describe('Vector 3 — Composition scheme (flat 1%)', () => {
  it('taxableTurnover=10000, compositionLiability=100', () => {
    const { taxableTurnover, compositionLiability } =
      calculateCompositionTotals([LINE_10000_18PCT], 100)
    expect(taxableTurnover).toBe(10_000)
    expect(compositionLiability).toBe(100)
  })

  it('5% composition on 10000 => liability=500', () => {
    const { compositionLiability } = calculateCompositionTotals([LINE_10000_18PCT], 500)
    expect(compositionLiability).toBe(500)
  })

  it('zero rate => zero liability', () => {
    const { compositionLiability } = calculateCompositionTotals([LINE_10000_18PCT], 0)
    expect(compositionLiability).toBe(0)
  })

  it('6% composition (service) on two lines', () => {
    const lines: TaxLineInput[] = [
      LINE_10000_18PCT,
      { lineTotal: 5_000, gstRate: 0, cessRate: 0, cessType: 'PERCENTAGE', quantity: 1 },
    ]
    const { taxableTurnover, compositionLiability } = calculateCompositionTotals(lines, 600)
    expect(taxableTurnover).toBe(15_000)
    expect(compositionLiability).toBe(900)
  })
})

// ─── Vector 4: Inclusive 11800 @ 18% ─────────────────────────────────────────

describe('Vector 4 — Inclusive pricing: 11800 paise @ 18%', () => {
  it('taxableValue=10000, gstAmount=1800', () => {
    const { taxableValue, gstAmount } = backCalculateInclusive(11_800, 1800)
    expect(taxableValue).toBe(10_000)
    expect(gstAmount).toBe(1_800)
    expect(taxableValue + gstAmount).toBe(11_800)
  })

  it('taxableValue + gstAmount = lineTotal for any amount', () => {
    const amount = 23_600
    const { taxableValue, gstAmount } = backCalculateInclusive(amount, 1800)
    expect(taxableValue + gstAmount).toBe(amount)
  })

  it('zero gst rate returns full amount as taxableValue', () => {
    const { taxableValue, gstAmount } = backCalculateInclusive(11_800, 0)
    expect(taxableValue).toBe(11_800)
    expect(gstAmount).toBe(0)
  })

  it('28% inclusive: round-trip invariant holds', () => {
    const { taxableValue, gstAmount } = backCalculateInclusive(11_800, 2800)
    expect(taxableValue + gstAmount).toBe(11_800)
    expect(taxableValue).toBeGreaterThan(0)
    expect(gstAmount).toBeGreaterThan(0)
  })
})

// ─── Vector 5: RCM flag ───────────────────────────────────────────────────────

describe('Vector 5 — RCM flag', () => {
  it('intra: applyRcmFlag zeros document totals', () => {
    const summary = calculateDocumentTax([LINE_10000_18PCT], false)
    expect(summary.totalCgst).toBe(900)

    const rcm = applyRcmFlag(summary, true)
    expect(rcm.totalCgst).toBe(0)
    expect(rcm.totalSgst).toBe(0)
    expect(rcm.totalIgst).toBe(0)
    expect(rcm.totalCess).toBe(0)
    expect(rcm.totalTax).toBe(0)
  })

  it('inter: applyRcmFlag zeros totalIgst', () => {
    const summary = calculateDocumentTax([LINE_10000_18PCT], true)
    expect(summary.totalIgst).toBe(1800)

    const rcm = applyRcmFlag(summary, true)
    expect(rcm.totalIgst).toBe(0)
    expect(rcm.totalTax).toBe(0)
  })

  it('original summary is NOT mutated (immutability check)', () => {
    const summary = calculateDocumentTax([LINE_10000_18PCT], false)
    applyRcmFlag(summary, true)
    expect(summary.totalCgst).toBe(900)
    expect(summary.lineResults[0].cgstAmount).toBe(900)
  })

  it('isRcm=false is a no-op (returns same reference)', () => {
    const summary = calculateDocumentTax([LINE_10000_18PCT], false)
    const result = applyRcmFlag(summary, false)
    expect(result).toBe(summary)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('empty lines produce zero document totals', () => {
    const doc = calculateDocumentTax([], false)
    expect(doc.totalTaxableValue).toBe(0)
    expect(doc.totalTax).toBe(0)
    expect(doc.lineResults).toHaveLength(0)
  })

  it('zero gstRate line returns zero tax', () => {
    const line: TaxLineInput = { lineTotal: 10_000, gstRate: 0, cessRate: 0, cessType: 'PERCENTAGE', quantity: 1 }
    const r = calculateLineTax(line, false)
    expect(r.cgstAmount).toBe(0)
    expect(r.sgstAmount).toBe(0)
    expect(r.totalTax).toBe(0)
  })

  it('cess PERCENTAGE on taxable value', () => {
    const line: TaxLineInput = { lineTotal: 100_000, gstRate: 2800, cessRate: 200, cessType: 'PERCENTAGE', quantity: 1 }
    const r = calculateLineTax(line, false)
    expect(r.cessAmount).toBe(2000) // 2% of 100000 = 2000
  })

  it('cess FIXED_PER_UNIT on quantity', () => {
    const line: TaxLineInput = { lineTotal: 100_000, gstRate: 1800, cessRate: 500, cessType: 'FIXED_PER_UNIT', quantity: 10 }
    const r = calculateLineTax(line, false)
    expect(r.cessAmount).toBe(5000) // 10 * 500
  })
})
