import { describe, it, expect } from 'vitest'
import {
  calculateDiscount,
  autoAllocateFIFO,
  calculateUnallocatedAmount,
  calculateSettlement,
  calculateAgingTotal,
  getAgingPercentages,
  formatPaymentMode,
  getReferencePlaceholder,
} from '../payment-calculation.utils'

// ─── calculateDiscount ────────────────────────────────────────────────────────

describe('calculateDiscount', () => {
  it('calculates percentage discount', () => {
    expect(calculateDiscount('PERCENTAGE', 10, 1000000)).toBe(100000)
  })

  it('caps percentage at 100', () => {
    expect(calculateDiscount('PERCENTAGE', 150, 1000000)).toBe(1000000)
  })

  it('returns fixed amount as-is', () => {
    expect(calculateDiscount('FIXED', 50000, 1000000)).toBe(50000)
  })

  it('caps fixed at outstanding', () => {
    expect(calculateDiscount('FIXED', 2000000, 1000000)).toBe(1000000)
  })

  it('returns 0 for zero value', () => {
    expect(calculateDiscount('PERCENTAGE', 0, 1000000)).toBe(0)
    expect(calculateDiscount('FIXED', 0, 1000000)).toBe(0)
  })

  it('returns 0 for zero outstanding', () => {
    expect(calculateDiscount('PERCENTAGE', 10, 0)).toBe(0)
  })

  it('rounds percentage result', () => {
    // 33% of 10000 = 3300 (integer math)
    expect(calculateDiscount('PERCENTAGE', 33, 10000)).toBe(3300)
  })
})

// ─── autoAllocateFIFO ─────────────────────────────────────────────────────────

describe('autoAllocateFIFO', () => {
  it('allocates to invoices in order', () => {
    const invoices = [
      { invoiceId: 'a', invoiceDue: 10000, amount: 0, invoiceNumber: '', selected: true },
      { invoiceId: 'b', invoiceDue: 8000, amount: 0, invoiceNumber: '', selected: true },
    ]
    const result = autoAllocateFIFO(15000, invoices)
    expect(result[0].amount).toBe(10000)
    expect(result[1].amount).toBe(5000)
  })

  it('zeroes out invoices beyond payment amount', () => {
    const invoices = [
      { invoiceId: 'a', invoiceDue: 10000, amount: 0, invoiceNumber: '', selected: true },
      { invoiceId: 'b', invoiceDue: 8000, amount: 0, invoiceNumber: '', selected: true },
    ]
    const result = autoAllocateFIFO(5000, invoices)
    expect(result[0].amount).toBe(5000)
    expect(result[1].amount).toBe(0)
  })

  it('handles exact amount', () => {
    const invoices = [
      { invoiceId: 'a', invoiceDue: 5000, amount: 0, invoiceNumber: '', selected: true },
    ]
    const result = autoAllocateFIFO(5000, invoices)
    expect(result[0].amount).toBe(5000)
  })

  it('handles empty invoices', () => {
    expect(autoAllocateFIFO(10000, [])).toEqual([])
  })
})

// ─── calculateUnallocatedAmount ───────────────────────────────────────────────

describe('calculateUnallocatedAmount', () => {
  it('returns unallocated portion', () => {
    const allocs = [
      { invoiceId: 'a', invoiceDue: 10000, amount: 10000, invoiceNumber: '', selected: true },
      { invoiceId: 'b', invoiceDue: 8000, amount: 3000, invoiceNumber: '', selected: true },
    ]
    expect(calculateUnallocatedAmount(15000, allocs)).toBe(2000)
  })

  it('returns 0 when fully allocated', () => {
    const allocs = [
      { invoiceId: 'a', invoiceDue: 10000, amount: 10000, invoiceNumber: '', selected: true },
    ]
    expect(calculateUnallocatedAmount(10000, allocs)).toBe(0)
  })

  it('never returns negative', () => {
    const allocs = [
      { invoiceId: 'a', invoiceDue: 10000, amount: 15000, invoiceNumber: '', selected: true },
    ]
    expect(calculateUnallocatedAmount(10000, allocs)).toBe(0)
  })
})

// ─── calculateSettlement ──────────────────────────────────────────────────────

describe('calculateSettlement', () => {
  it('returns payment + 0 discount when no discount', () => {
    const result = calculateSettlement(1000000, null)
    expect(result).toEqual({ payment: 1000000, discount: 0, totalSettled: 1000000 })
  })

  it('includes fixed discount in total settled', () => {
    const result = calculateSettlement(900000, { type: 'FIXED', value: 100000, calculatedAmount: 100000, reason: '' })
    expect(result.payment).toBe(900000)
    expect(result.discount).toBe(100000)
    expect(result.totalSettled).toBe(1000000)
  })

  it('calculates percentage discount', () => {
    const result = calculateSettlement(1000000, { type: 'PERCENTAGE', value: 10, calculatedAmount: 100000, reason: '' })
    expect(result.discount).toBe(100000)
    expect(result.totalSettled).toBe(1100000)
  })
})

// ─── calculateAgingTotal ──────────────────────────────────────────────────────

describe('calculateAgingTotal', () => {
  it('sums all aging buckets', () => {
    expect(calculateAgingTotal({
      current: 5000, days1to30: 3000, days31to60: 2000, days61to90: 1000, days90plus: 500,
    })).toBe(11500)
  })

  it('returns 0 for all-zero buckets', () => {
    expect(calculateAgingTotal({
      current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0,
    })).toBe(0)
  })
})

// ─── getAgingPercentages ──────────────────────────────────────────────────────

describe('getAgingPercentages', () => {
  it('returns percentages of total', () => {
    const pcts = getAgingPercentages({
      current: 10000, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0,
    })
    expect(pcts.current).toBe(100)
    expect(pcts.days1to30).toBe(0)
  })

  it('returns all zeros for zero total', () => {
    const pcts = getAgingPercentages({
      current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0,
    })
    expect(Object.values(pcts).every((v) => v === 0)).toBe(true)
  })
})

// ─── formatPaymentMode ────────────────────────────────────────────────────────

describe('formatPaymentMode', () => {
  it('returns label for known mode', () => {
    expect(formatPaymentMode('CASH')).toBeTruthy()
    expect(formatPaymentMode('UPI')).toBeTruthy()
  })

  it('falls back to raw mode for unknown', () => {
    expect(formatPaymentMode('CRYPTO')).toBe('CRYPTO')
  })
})

// ─── getReferencePlaceholder ──────────────────────────────────────────────────

describe('getReferencePlaceholder', () => {
  it('returns placeholder for known mode', () => {
    expect(getReferencePlaceholder('UPI')).toBeTruthy()
    expect(getReferencePlaceholder('CHEQUE')).toBeTruthy()
  })

  it('returns "Reference" for unknown mode', () => {
    expect(getReferencePlaceholder('UNKNOWN')).toBe('Reference')
  })
})
