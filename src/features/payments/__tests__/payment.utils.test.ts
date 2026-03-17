import { describe, it, expect } from 'vitest'
import {
  validatePaymentAmount,
  validatePaymentForm,
  calculateDiscount,
  autoAllocateFIFO,
  calculateUnallocatedAmount,
  calculateSettlement,
  calculateAgingTotal,
  getAgingPercentages,
  formatPaymentMode,
  getReferencePlaceholder,
} from '../payment.utils'
import type { PaymentFormAllocation, PaymentFormData } from '../payment.types'

// ─── Amount validation ───────────────────────────────────────────────────────

describe('validatePaymentAmount', () => {
  it('rejects zero', () => {
    expect(validatePaymentAmount(0)).toMatch(/greater than zero/)
  })

  it('rejects negative', () => {
    expect(validatePaymentAmount(-100)).toMatch(/greater than zero/)
  })

  it('rejects non-integer (fractional paise)', () => {
    expect(validatePaymentAmount(99.5)).toMatch(/whole number/)
  })

  it('rejects NaN', () => {
    expect(validatePaymentAmount(NaN)).toMatch(/greater than zero/)
  })

  it('accepts valid amount', () => {
    expect(validatePaymentAmount(100)).toBeNull()
  })

  it('accepts large valid amount', () => {
    expect(validatePaymentAmount(100000000)).toBeNull()
  })
})

// ─── Form validation ─────────────────────────────────────────────────────────

describe('validatePaymentForm', () => {
  const validForm: PaymentFormData = {
    type: 'PAYMENT_IN',
    partyId: 'party_1',
    amount: 50000,
    date: '2026-03-17',
    mode: 'CASH',
    referenceNumber: '',
    notes: '',
    allocations: [],
    discount: null,
  }

  it('returns empty errors for valid form', () => {
    expect(validatePaymentForm(validForm)).toEqual({})
  })

  it('requires partyId', () => {
    const errors = validatePaymentForm({ ...validForm, partyId: '' })
    expect(errors.partyId).toBeDefined()
  })

  it('requires date', () => {
    const errors = validatePaymentForm({ ...validForm, date: '' })
    expect(errors.date).toBeDefined()
  })

  it('validates allocation total <= payment', () => {
    const allocs: PaymentFormAllocation[] = [
      { invoiceId: 'a', invoiceNumber: 'INV-001', invoiceDue: 100000, amount: 60000, selected: true },
    ]
    const errors = validatePaymentForm({ ...validForm, amount: 50000, allocations: allocs })
    expect(errors.allocations).toMatch(/exceeds/)
  })
})

// ─── Discount calculation ────────────────────────────────────────────────────

describe('calculateDiscount (payment)', () => {
  it('calculates percentage discount', () => {
    expect(calculateDiscount('PERCENTAGE', 10, 1000000)).toBe(100000)
  })

  it('calculates fixed discount', () => {
    expect(calculateDiscount('FIXED', 50000, 1000000)).toBe(50000)
  })

  it('caps fixed discount at outstanding', () => {
    expect(calculateDiscount('FIXED', 2000000, 1000000)).toBe(1000000)
  })

  it('returns 0 for zero value', () => {
    expect(calculateDiscount('PERCENTAGE', 0, 1000000)).toBe(0)
  })

  it('returns 0 for zero outstanding', () => {
    expect(calculateDiscount('FIXED', 5000, 0)).toBe(0)
  })
})

// ─── FIFO allocation ─────────────────────────────────────────────────────────

describe('autoAllocateFIFO', () => {
  const invoices: PaymentFormAllocation[] = [
    { invoiceId: 'a', invoiceNumber: 'INV-001', invoiceDue: 10000, amount: 0, selected: true },
    { invoiceId: 'b', invoiceNumber: 'INV-002', invoiceDue: 8000, amount: 0, selected: true },
  ]

  it('allocates fully to first, remainder to second', () => {
    const result = autoAllocateFIFO(15000, invoices)
    expect(result[0].amount).toBe(10000)
    expect(result[1].amount).toBe(5000)
  })

  it('allocates all to first when amount < first due', () => {
    const result = autoAllocateFIFO(5000, invoices)
    expect(result[0].amount).toBe(5000)
    expect(result[1].amount).toBe(0)
  })

  it('handles zero amount', () => {
    const result = autoAllocateFIFO(0, invoices)
    expect(result[0].amount).toBe(0)
    expect(result[1].amount).toBe(0)
  })

  it('handles excess amount (pays both fully)', () => {
    const result = autoAllocateFIFO(25000, invoices)
    expect(result[0].amount).toBe(10000)
    expect(result[1].amount).toBe(8000)
  })
})

// ─── Unallocated amount ──────────────────────────────────────────────────────

describe('calculateUnallocatedAmount', () => {
  it('calculates remaining', () => {
    const allocs: PaymentFormAllocation[] = [
      { invoiceId: 'a', invoiceNumber: 'INV-001', invoiceDue: 10000, amount: 10000, selected: true },
      { invoiceId: 'b', invoiceNumber: 'INV-002', invoiceDue: 8000, amount: 3000, selected: true },
    ]
    expect(calculateUnallocatedAmount(15000, allocs)).toBe(2000)
  })

  it('returns 0 when fully allocated', () => {
    const allocs: PaymentFormAllocation[] = [
      { invoiceId: 'a', invoiceNumber: 'INV-001', invoiceDue: 5000, amount: 5000, selected: true },
    ]
    expect(calculateUnallocatedAmount(5000, allocs)).toBe(0)
  })
})

// ─── Settlement ──────────────────────────────────────────────────────────────

describe('calculateSettlement', () => {
  it('calculates with fixed discount', () => {
    const result = calculateSettlement(900000, { type: 'FIXED', value: 100000, calculatedAmount: 100000, reason: '' })
    expect(result.payment).toBe(900000)
    expect(result.discount).toBe(100000)
    expect(result.totalSettled).toBe(1000000)
  })

  it('calculates without discount', () => {
    const result = calculateSettlement(1000000, null)
    expect(result.discount).toBe(0)
    expect(result.totalSettled).toBe(1000000)
  })
})

// ─── Aging ───────────────────────────────────────────────────────────────────

describe('calculateAgingTotal', () => {
  it('sums all buckets', () => {
    expect(calculateAgingTotal({
      current: 5000, days1to30: 3000, days31to60: 2000, days61to90: 1000, days90plus: 500,
    })).toBe(11500)
  })
})

describe('getAgingPercentages', () => {
  it('calculates percentages', () => {
    const result = getAgingPercentages({
      current: 10000, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0,
    })
    expect(result.current).toBe(100)
    expect(result.days1to30).toBe(0)
  })

  it('returns all zeros for zero total', () => {
    const result = getAgingPercentages({
      current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0,
    })
    expect(result.current).toBe(0)
  })
})

// ─── Format helpers ──────────────────────────────────────────────────────────

describe('formatPaymentMode', () => {
  it('formats known mode', () => {
    expect(formatPaymentMode('CHEQUE')).toBe('Cheque')
  })

  it('falls back to raw string for unknown', () => {
    expect(formatPaymentMode('CRYPTO')).toBe('CRYPTO')
  })
})

describe('getReferencePlaceholder', () => {
  it('returns UPI placeholder', () => {
    expect(getReferencePlaceholder('UPI')).toBe('UPI Transaction ID')
  })

  it('returns generic for unknown mode', () => {
    expect(getReferencePlaceholder('UNKNOWN')).toBe('Reference')
  })
})
