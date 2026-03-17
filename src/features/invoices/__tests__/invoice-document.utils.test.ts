import { describe, it, expect } from 'vitest'
import {
  getPaymentStatus,
  generateDocumentNumber,
  isConversionAllowed,
  getStockEffect,
  getOutstandingEffect,
} from '../invoice-document.utils'

// ─── Payment status ──────────────────────────────────────────────────────────

describe('getPaymentStatus', () => {
  it('returns UNPAID for zero paid', () => {
    expect(getPaymentStatus(100000, 0)).toBe('UNPAID')
  })

  it('returns PARTIAL for partial payment', () => {
    expect(getPaymentStatus(100000, 50000)).toBe('PARTIAL')
  })

  it('returns PAID when fully paid', () => {
    expect(getPaymentStatus(100000, 100000)).toBe('PAID')
  })

  it('returns PAID when overpaid', () => {
    expect(getPaymentStatus(100000, 150000)).toBe('PAID')
  })
})

// ─── Document number ─────────────────────────────────────────────────────────

describe('generateDocumentNumber', () => {
  it('pads sequence with leading zeros', () => {
    expect(generateDocumentNumber('INV', '2526', 1, 3, '-')).toBe('INV-2526-001')
  })

  it('does not truncate large sequences', () => {
    expect(generateDocumentNumber('INV', '2526', 1000, 3, '-')).toBe('INV-2526-1000')
  })
})

// ─── Conversion rules ────────────────────────────────────────────────────────

describe('isConversionAllowed', () => {
  it('allows ESTIMATE → SALE_INVOICE', () => {
    expect(isConversionAllowed('ESTIMATE', 'SALE_INVOICE')).toBe(true)
  })

  it('blocks SALE_INVOICE → anything (terminal)', () => {
    expect(isConversionAllowed('SALE_INVOICE', 'ESTIMATE')).toBe(false)
  })
})

// ─── Stock / outstanding effects ─────────────────────────────────────────────

describe('getStockEffect', () => {
  it('SALE_INVOICE decreases stock', () => {
    expect(getStockEffect('SALE_INVOICE')).toBe('DECREASE')
  })

  it('PURCHASE_INVOICE increases stock', () => {
    expect(getStockEffect('PURCHASE_INVOICE')).toBe('INCREASE')
  })

  it('ESTIMATE has no stock effect', () => {
    expect(getStockEffect('ESTIMATE')).toBe('NONE')
  })
})

describe('getOutstandingEffect', () => {
  it('SALE_INVOICE is receivable', () => {
    expect(getOutstandingEffect('SALE_INVOICE')).toBe('RECEIVABLE')
  })

  it('PURCHASE_INVOICE is payable', () => {
    expect(getOutstandingEffect('PURCHASE_INVOICE')).toBe('PAYABLE')
  })
})
