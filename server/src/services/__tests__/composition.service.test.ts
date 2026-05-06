/**
 * Composition Scheme Service unit tests — GST Phase 2 PR 6
 * All amounts in PAISE. Rates in BASIS POINTS.
 */

import { describe, it, expect } from 'vitest'
import {
  getCompositionRate,
  calculateCompositionTax,
  validateCompositionInvoice,
  getCompositionInvoiceInfo,
} from '../composition.service.js'
import {
  assertCompositionNoLineTax,
  assertCompositionNoInterState,
} from '../document/create-tax-prep.js'

// ─── getCompositionRate ───────────────────────────────────────────────────────

describe('getCompositionRate', () => {
  it('manufacturer → 100 bp (1%)', () => {
    expect(getCompositionRate('manufacturer')).toBe(100)
  })
  it('trader → 100 bp (1%)', () => {
    expect(getCompositionRate('trader')).toBe(100)
  })
  it('restaurant → 500 bp (5%)', () => {
    expect(getCompositionRate('restaurant')).toBe(500)
  })
  it('default → 600 bp (6%)', () => {
    expect(getCompositionRate('unknown')).toBe(600)
  })
  it('case-insensitive: Manufacturer → 100', () => {
    expect(getCompositionRate('Manufacturer')).toBe(100)
  })
})

// ─── calculateCompositionTax ──────────────────────────────────────────────────

describe('calculateCompositionTax', () => {
  it('1% on 10000 paise → 100', () => {
    expect(calculateCompositionTax(10_000, 100)).toBe(100)
  })
  it('5% on 100000 paise → 5000', () => {
    expect(calculateCompositionTax(100_000, 500)).toBe(5_000)
  })
  it('6% on 150000 paise → 9000', () => {
    expect(calculateCompositionTax(150_000, 600)).toBe(9_000)
  })
  it('rounds banker-style: 1% on 1001 paise → 10', () => {
    // 1001 * 100 / 10000 = 10.01 → Math.round = 10
    expect(calculateCompositionTax(1_001, 100)).toBe(10)
  })
  it('zero rate → 0 liability', () => {
    expect(calculateCompositionTax(50_000, 0)).toBe(0)
  })
})

// ─── validateCompositionInvoice ───────────────────────────────────────────────

describe('validateCompositionInvoice', () => {
  it('non-composition doc → no throw', () => {
    expect(() =>
      validateCompositionInvoice({
        isComposite: false,
        placeOfSupply: '29',
        businessStateCode: '27',
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
      })
    ).not.toThrow()
  })

  it('composition + CGST > 0 → throws', () => {
    expect(() =>
      validateCompositionInvoice({
        isComposite: true,
        placeOfSupply: '27',
        businessStateCode: '27',
        totalCgst: 500,
        totalSgst: 500,
        totalIgst: 0,
      })
    ).toThrow('cannot charge CGST/SGST/IGST')
  })

  it('composition + inter-state → throws', () => {
    expect(() =>
      validateCompositionInvoice({
        isComposite: true,
        placeOfSupply: '29',
        businessStateCode: '27',
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
      })
    ).toThrow('inter-state outward supplies')
  })

  it('composition + intra-state + no tax → no throw', () => {
    expect(() =>
      validateCompositionInvoice({
        isComposite: true,
        placeOfSupply: '27',
        businessStateCode: '27',
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
      })
    ).not.toThrow()
  })
})

// ─── assertCompositionNoLineTax ───────────────────────────────────────────────

describe('assertCompositionNoLineTax', () => {
  it('non-composite → no throw even with taxCategoryId', () => {
    expect(() =>
      assertCompositionNoLineTax(false, [{ taxCategoryId: 'tax-1' }])
    ).not.toThrow()
  })

  it('composite + taxCategoryId → throws', () => {
    expect(() =>
      assertCompositionNoLineTax(true, [{ taxCategoryId: 'tax-1' }])
    ).toThrow('must not have line-level tax categories')
  })

  it('composite + no taxCategoryId → no throw', () => {
    expect(() =>
      assertCompositionNoLineTax(true, [{ taxCategoryId: null }])
    ).not.toThrow()
  })
})

// ─── assertCompositionNoInterState ────────────────────────────────────────────

describe('assertCompositionNoInterState', () => {
  it('non-composite → no throw for inter-state', () => {
    expect(() =>
      assertCompositionNoInterState(false, '27', '29')
    ).not.toThrow()
  })

  it('composite + same state → no throw', () => {
    expect(() =>
      assertCompositionNoInterState(true, '27', '27')
    ).not.toThrow()
  })

  it('composite + different state → throws', () => {
    expect(() =>
      assertCompositionNoInterState(true, '27', '29')
    ).toThrow('inter-state outward supplies')
  })

  it('composite + null placeOfSupply → no throw (guard)', () => {
    expect(() =>
      assertCompositionNoInterState(true, '27', null)
    ).not.toThrow()
  })
})

// ─── getCompositionInvoiceInfo ────────────────────────────────────────────────

describe('getCompositionInvoiceInfo', () => {
  it('non-composite → returns null', () => {
    expect(getCompositionInvoiceInfo(false, 'trader', 100_000)).toBeNull()
  })

  it('composite + default type → 6% liability', () => {
    const info = getCompositionInvoiceInfo(true, 'default', 100_000)
    expect(info).not.toBeNull()
    expect(info!.isComposite).toBe(true)
    expect(info!.compositionRate).toBe(600)
    expect(info!.compositionTax).toBe(6_000)
  })

  it('composite + restaurant → 5% liability', () => {
    const info = getCompositionInvoiceInfo(true, 'restaurant', 200_000)
    expect(info!.compositionTax).toBe(10_000)
  })

  it('invoice label is Bill of Supply', () => {
    const info = getCompositionInvoiceInfo(true, 'trader', 50_000)
    expect(info!.invoiceLabel).toBe('Bill of Supply')
  })
})
