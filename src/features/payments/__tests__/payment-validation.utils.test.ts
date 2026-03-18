import { describe, it, expect } from 'vitest'
import { validatePaymentAmount, validatePaymentForm } from '../payment-validation.utils'
import type { PaymentFormData } from '../payment.types'

// ─── validatePaymentAmount ────────────────────────────────────────────────────

describe('validatePaymentAmount', () => {
  it('returns null for valid amount', () => {
    expect(validatePaymentAmount(100)).toBeNull()
    expect(validatePaymentAmount(1000000)).toBeNull()
  })

  it('rejects zero', () => {
    expect(validatePaymentAmount(0)).toBe('Amount must be greater than zero')
  })

  it('rejects negative', () => {
    expect(validatePaymentAmount(-100)).toBe('Amount must be greater than zero')
  })

  it('rejects non-integer (floating point paise)', () => {
    expect(validatePaymentAmount(99.5)).toBe('Amount must be a whole number (paise)')
  })

  it('rejects NaN', () => {
    expect(validatePaymentAmount(NaN)).toBe('Amount must be greater than zero')
  })

  it('rejects Infinity', () => {
    expect(validatePaymentAmount(Infinity)).toBe('Amount must be greater than zero')
  })

  it('rejects amount exceeding max', () => {
    expect(validatePaymentAmount(999999999999)).toMatch(/cannot exceed/)
  })
})

// ─── validatePaymentForm ──────────────────────────────────────────────────────

describe('validatePaymentForm', () => {
  const validForm: PaymentFormData = {
    partyId: 'party-1',
    amount: 100000,
    date: '2026-03-18',
    mode: 'CASH',
    type: 'PAYMENT_IN',
  }

  it('returns empty errors for valid form', () => {
    expect(Object.keys(validatePaymentForm(validForm))).toHaveLength(0)
  })

  it('requires partyId', () => {
    expect(validatePaymentForm({ ...validForm, partyId: '' }).partyId).toBeTruthy()
  })

  it('requires amount', () => {
    expect(validatePaymentForm({ ...validForm, amount: 0 }).amount).toBeTruthy()
  })

  it('requires date', () => {
    expect(validatePaymentForm({ ...validForm, date: '' }).date).toBeTruthy()
  })

  it('requires mode', () => {
    expect(validatePaymentForm({ ...validForm, mode: '' }).mode).toBeTruthy()
  })

  it('validates reference number length', () => {
    const longRef = 'a'.repeat(200)
    expect(validatePaymentForm({ ...validForm, referenceNumber: longRef }).referenceNumber).toBeTruthy()
  })

  it('validates notes length', () => {
    const longNotes = 'a'.repeat(1000)
    expect(validatePaymentForm({ ...validForm, notes: longNotes }).notes).toBeTruthy()
  })

  it('validates allocation total not exceeding amount', () => {
    const form = {
      ...validForm,
      allocations: [
        { invoiceId: 'a', invoiceDue: 200000, amount: 200000, invoiceNumber: '', invoiceDate: '' },
      ],
    }
    expect(validatePaymentForm(form).allocations).toBeTruthy()
  })

  it('validates discount percentage range', () => {
    const form = {
      ...validForm,
      discount: { type: 'PERCENTAGE' as const, value: 150, reason: null },
    }
    expect(validatePaymentForm(form)['discount.value']).toBeTruthy()
  })

  it('validates fixed discount not exceeding amount', () => {
    const form = {
      ...validForm,
      discount: { type: 'FIXED' as const, value: 200000, reason: null },
    }
    expect(validatePaymentForm(form)['discount.value']).toBeTruthy()
  })
})
