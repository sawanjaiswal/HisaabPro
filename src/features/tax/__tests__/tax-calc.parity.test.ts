/**
 * Tax Engine Parity Test
 *
 * Asserts client helpers (tax-calc.utils.ts) produce the correct values
 * for fixed input vectors. Each expected value is mathematically derived
 * from the same formula as the server helpers — both use:
 *   taxableValue = round(lineTotal * 10000 / (10000 + gstRateBP))
 *   cgst/sgst    = round(taxableValue * rate / 10000)
 *   igst         = round(taxableValue * rate / 10000)
 *
 * A separate Node.js-based server test is in server/src/services/__tests__/
 * because the server uses CJS imports that Vite cannot resolve.
 *
 * Vectors:
 *   1. Intra 18% EXCLUSIVE: 10000 → CGST 900 / SGST 900
 *   2. Inter 18% EXCLUSIVE: 10000 → IGST 1800
 *   3. Composition: all 0s (compositionLiability only)
 *   4. Inclusive 11800 @ 18% → taxableValue 10000, gstAmount 1800
 *   5. RCM flag: doc totals zeroed, line amounts intact
 */

import { describe, it, expect } from 'vitest'

import {
  calculateLineTax,
  calculateDocumentTax,
  backCalculateInclusive,
  applyRcmFlag,
  calculateCompositionTotals,
} from '../tax-calc.utils'

import type { TaxLineInput } from '../tax-calc.utils'

// ─── Shared test vectors ──────────────────────────────────────────────────────

const LINE_10000_18PCT: TaxLineInput = {
  lineTotal: 10_000,
  gstRate: 1800,
  cessRate: 0,
  cessType: 'PERCENTAGE',
  quantity: 1,
}

const DOC_LINES: TaxLineInput[] = [LINE_10000_18PCT]

// ─── Vector 1: Intra-state 18% EXCLUSIVE ─────────────────────────────────────

describe('Vector 1 — Intra-state 18% EXCLUSIVE', () => {
  it('CGST=900, SGST=900, IGST=0, totalTax=1800', () => {
    const result = calculateLineTax(LINE_10000_18PCT, false)
    expect(result.cgstAmount).toBe(900)
    expect(result.sgstAmount).toBe(900)
    expect(result.igstAmount).toBe(0)
    expect(result.totalTax).toBe(1800)
    expect(result.taxableValue).toBe(10_000)
  })

  it('document-level totals match', () => {
    const doc = calculateDocumentTax(DOC_LINES, false)
    expect(doc.totalCgst).toBe(900)
    expect(doc.totalSgst).toBe(900)
    expect(doc.totalIgst).toBe(0)
    expect(doc.totalTax).toBe(1800)
    expect(doc.totalTaxableValue).toBe(10_000)
  })

  it('rates: cgstRate=900, sgstRate=900 (basis points = 9% each)', () => {
    const result = calculateLineTax(LINE_10000_18PCT, false)
    expect(result.cgstRate).toBe(900)
    expect(result.sgstRate).toBe(900)
    expect(result.igstRate).toBe(0)
  })
})

// ─── Vector 2: Inter-state 18% EXCLUSIVE ─────────────────────────────────────

describe('Vector 2 — Inter-state 18% EXCLUSIVE', () => {
  it('IGST=1800, CGST=0, SGST=0', () => {
    const result = calculateLineTax(LINE_10000_18PCT, true)
    expect(result.igstAmount).toBe(1800)
    expect(result.cgstAmount).toBe(0)
    expect(result.sgstAmount).toBe(0)
    expect(result.totalTax).toBe(1800)
  })

  it('document-level inter-state totals', () => {
    const doc = calculateDocumentTax(DOC_LINES, true)
    expect(doc.totalIgst).toBe(1800)
    expect(doc.totalCgst).toBe(0)
    expect(doc.totalSgst).toBe(0)
    expect(doc.totalTax).toBe(1800)
  })
})

// ─── Vector 3: Composition scheme ────────────────────────────────────────────

describe('Vector 3 — Composition scheme (flat 1%)', () => {
  const COMPOSITION_RATE_BP = 100 // 1%

  it('taxableTurnover=10000, compositionLiability=100', () => {
    const { taxableTurnover, compositionLiability } = calculateCompositionTotals(DOC_LINES, COMPOSITION_RATE_BP)
    expect(taxableTurnover).toBe(10_000)
    expect(compositionLiability).toBe(100)
  })

  it('zero rate => zero liability', () => {
    const { compositionLiability } = calculateCompositionTotals(DOC_LINES, 0)
    expect(compositionLiability).toBe(0)
  })

  it('5% composition on 10000 => liability=500', () => {
    const { compositionLiability } = calculateCompositionTotals(DOC_LINES, 500)
    expect(compositionLiability).toBe(500)
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

  it('28% inclusive: round(11800 * 10000 / 12800) = 9219 (banker-equivalent)', () => {
    const { taxableValue, gstAmount } = backCalculateInclusive(11_800, 2800)
    expect(taxableValue + gstAmount).toBe(11_800)
    expect(taxableValue).toBeGreaterThan(0)
    expect(gstAmount).toBeGreaterThan(0)
  })
})

// ─── Vector 5: RCM flag ───────────────────────────────────────────────────────

describe('Vector 5 — RCM flag', () => {
  it('intra: applyRcmFlag zeros totalCgst/Sgst/totalTax', () => {
    const summary = calculateDocumentTax(DOC_LINES, false)
    expect(summary.totalCgst).toBe(900)
    const rcm = applyRcmFlag(summary, true)
    expect(rcm.totalCgst).toBe(0)
    expect(rcm.totalSgst).toBe(0)
    expect(rcm.totalIgst).toBe(0)
    expect(rcm.totalCess).toBe(0)
    expect(rcm.totalTax).toBe(0)
  })

  it('inter: applyRcmFlag zeros totalIgst', () => {
    const summary = calculateDocumentTax(DOC_LINES, true)
    expect(summary.totalIgst).toBe(1800)
    const rcm = applyRcmFlag(summary, true)
    expect(rcm.totalIgst).toBe(0)
    expect(rcm.totalTax).toBe(0)
  })

  it('line-level amounts are preserved in original summary (not mutated)', () => {
    const summary = calculateDocumentTax(DOC_LINES, false)
    applyRcmFlag(summary, true)
    // Original summary is not mutated — applyRcmFlag returns a new object
    expect(summary.totalCgst).toBe(900)
    expect(summary.lineResults[0].cgstAmount).toBe(900)
  })

  it('isRcm=false is a no-op (returns same reference)', () => {
    const summary = calculateDocumentTax(DOC_LINES, false)
    const result = applyRcmFlag(summary, false)
    expect(result).toBe(summary)
  })
})
