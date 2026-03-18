import { describe, it, expect } from 'vitest'
import {
  isInterState,
  calculateLineTax,
  calculateDocumentTax,
} from '../tax-calc.utils'
import type { TaxLineInput } from '../tax-calc.utils'

// ─── Inter-state detection ──────────────────────────────────────────────────

describe('isInterState', () => {
  it('returns false when business state code is null', () => {
    expect(isInterState(null, '27')).toBe(false)
  })

  it('returns false when place of supply is null', () => {
    expect(isInterState('29', null)).toBe(false)
  })

  it('returns false when both are null', () => {
    expect(isInterState(null, null)).toBe(false)
  })

  it('returns false for same state (intra-state)', () => {
    expect(isInterState('29', '29')).toBe(false)
  })

  it('returns true for different states (inter-state)', () => {
    expect(isInterState('29', '27')).toBe(true)
  })
})

// ─── Single line tax calculation ────────────────────────────────────────────

describe('calculateLineTax', () => {
  const baseLine: TaxLineInput = {
    lineTotal: 100_000, // Rs 1,000 in paise
    gstRate: 1800,      // 18% in basis points
    cessRate: 0,
    cessType: 'PERCENTAGE',
    quantity: 1,
  }

  describe('intra-state (CGST + SGST)', () => {
    it('splits GST evenly into CGST and SGST', () => {
      const result = calculateLineTax(baseLine, false)
      expect(result.cgstRate).toBe(900)
      expect(result.sgstRate).toBe(900)
      expect(result.cgstAmount).toBe(9000) // 9% of 100000
      expect(result.sgstAmount).toBe(9000)
      expect(result.igstRate).toBe(0)
      expect(result.igstAmount).toBe(0)
      expect(result.totalTax).toBe(18000)
    })

    it('handles odd GST rate (floor for CGST, remainder for SGST)', () => {
      const line: TaxLineInput = { ...baseLine, gstRate: 500 } // 5% = 500bp
      const result = calculateLineTax(line, false)
      // 500 / 2 = 250 (floor), sgst = 500 - 250 = 250
      expect(result.cgstRate).toBe(250)
      expect(result.sgstRate).toBe(250)
      expect(result.cgstAmount).toBe(2500)
      expect(result.sgstAmount).toBe(2500)
      expect(result.totalTax).toBe(5000)
    })

    it('handles odd basis points that do not divide evenly', () => {
      const line: TaxLineInput = { ...baseLine, gstRate: 75 } // 0.75%
      const result = calculateLineTax(line, false)
      expect(result.cgstRate).toBe(37)  // floor(75/2)
      expect(result.sgstRate).toBe(38)  // 75 - 37
      // cgst = round(100000 * 37 / 10000) = round(370) = 370
      expect(result.cgstAmount).toBe(370)
      // sgst = round(100000 * 38 / 10000) = round(380) = 380
      expect(result.sgstAmount).toBe(380)
      expect(result.totalTax).toBe(750)
    })
  })

  describe('inter-state (IGST)', () => {
    it('applies full GST as IGST', () => {
      const result = calculateLineTax(baseLine, true)
      expect(result.igstRate).toBe(1800)
      expect(result.igstAmount).toBe(18000)
      expect(result.cgstRate).toBe(0)
      expect(result.cgstAmount).toBe(0)
      expect(result.sgstRate).toBe(0)
      expect(result.sgstAmount).toBe(0)
      expect(result.totalTax).toBe(18000)
    })
  })

  describe('zero GST rate', () => {
    it('returns zero tax amounts', () => {
      const line: TaxLineInput = { ...baseLine, gstRate: 0 }
      const result = calculateLineTax(line, false)
      expect(result.cgstAmount).toBe(0)
      expect(result.sgstAmount).toBe(0)
      expect(result.totalTax).toBe(0)
    })
  })

  describe('cess - percentage type', () => {
    it('calculates percentage cess on taxable value', () => {
      const line: TaxLineInput = { ...baseLine, cessRate: 100, cessType: 'PERCENTAGE' }
      const result = calculateLineTax(line, false)
      // cess = round(100000 * 100 / 10000) = 1000
      expect(result.cessAmount).toBe(1000)
      expect(result.totalTax).toBe(18000 + 1000)
    })
  })

  describe('cess - fixed per unit type', () => {
    it('calculates fixed cess based on quantity', () => {
      const line: TaxLineInput = {
        ...baseLine,
        cessRate: 500, // Rs 5 per unit in paise
        cessType: 'FIXED_PER_UNIT',
        quantity: 10,
      }
      const result = calculateLineTax(line, false)
      // cess = round(10 * 500) = 5000
      expect(result.cessAmount).toBe(5000)
    })
  })

  describe('cess with zero rate', () => {
    it('returns zero cess', () => {
      const line: TaxLineInput = { ...baseLine, cessRate: 0, cessType: 'PERCENTAGE' }
      const result = calculateLineTax(line, false)
      expect(result.cessAmount).toBe(0)
    })
  })

  describe('taxable value passthrough', () => {
    it('sets taxableValue to lineTotal', () => {
      const result = calculateLineTax(baseLine, false)
      expect(result.taxableValue).toBe(100_000)
    })
  })

  describe('zero lineTotal', () => {
    it('returns all zeroes', () => {
      const line: TaxLineInput = { ...baseLine, lineTotal: 0 }
      const result = calculateLineTax(line, false)
      expect(result.cgstAmount).toBe(0)
      expect(result.sgstAmount).toBe(0)
      expect(result.totalTax).toBe(0)
    })
  })
})

// ─── Document-level tax summary ─────────────────────────────────────────────

describe('calculateDocumentTax', () => {
  it('aggregates multiple lines (intra-state)', () => {
    const lines: TaxLineInput[] = [
      { lineTotal: 100_000, gstRate: 1800, cessRate: 0, cessType: 'PERCENTAGE', quantity: 1 },
      { lineTotal: 200_000, gstRate: 1200, cessRate: 0, cessType: 'PERCENTAGE', quantity: 2 },
    ]
    const result = calculateDocumentTax(lines, false)
    expect(result.totalTaxableValue).toBe(300_000)
    // Line 1: cgst 9000, sgst 9000
    // Line 2: cgst 12000, sgst 12000
    expect(result.totalCgst).toBe(9000 + 12000)
    expect(result.totalSgst).toBe(9000 + 12000)
    expect(result.totalIgst).toBe(0)
    expect(result.totalCess).toBe(0)
    expect(result.totalTax).toBe(42000)
    expect(result.lineResults).toHaveLength(2)
  })

  it('aggregates multiple lines (inter-state)', () => {
    const lines: TaxLineInput[] = [
      { lineTotal: 100_000, gstRate: 1800, cessRate: 0, cessType: 'PERCENTAGE', quantity: 1 },
      { lineTotal: 50_000, gstRate: 500, cessRate: 0, cessType: 'PERCENTAGE', quantity: 1 },
    ]
    const result = calculateDocumentTax(lines, true)
    expect(result.totalCgst).toBe(0)
    expect(result.totalSgst).toBe(0)
    // Line 1: 18000 IGST, Line 2: 2500 IGST
    expect(result.totalIgst).toBe(20500)
    expect(result.totalTax).toBe(20500)
  })

  it('includes cess in totals', () => {
    const lines: TaxLineInput[] = [
      { lineTotal: 100_000, gstRate: 2800, cessRate: 200, cessType: 'PERCENTAGE', quantity: 1 },
    ]
    const result = calculateDocumentTax(lines, false)
    // cess = round(100000 * 200 / 10000) = 2000
    expect(result.totalCess).toBe(2000)
    expect(result.totalTax).toBe(14000 + 14000 + 2000) // cgst + sgst + cess
  })

  it('handles empty lines array', () => {
    const result = calculateDocumentTax([], false)
    expect(result.totalTaxableValue).toBe(0)
    expect(result.totalTax).toBe(0)
    expect(result.lineResults).toHaveLength(0)
  })
})
