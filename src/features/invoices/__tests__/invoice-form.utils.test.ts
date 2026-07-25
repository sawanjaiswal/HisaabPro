import { describe, it, expect } from 'vitest'
import { buildInitialForm, validateInvoiceForm, normalizeFormPayload } from '../invoice-form.utils'
import type { DocumentFormData } from '../invoice.types'

// ─── buildInitialForm ─────────────────────────────────────────────────────────

describe('buildInitialForm', () => {
  it('returns DRAFT status with correct type', () => {
    const form = buildInitialForm('SALE_INVOICE')
    expect(form.type).toBe('SALE_INVOICE')
    expect(form.status).toBe('DRAFT')
  })

  it('initializes empty line items and charges', () => {
    const form = buildInitialForm('PURCHASE_INVOICE')
    expect(form.lineItems).toEqual([])
    expect(form.additionalCharges).toEqual([])
  })

  it('sets default payment terms to COD', () => {
    const form = buildInitialForm('SALE_INVOICE')
    expect(form.paymentTerms).toBe('COD')
  })

  it('sets vehicleNumber to empty string', () => {
    const form = buildInitialForm('DELIVERY_CHALLAN')
    expect(form.vehicleNumber).toBe('')
  })

  it('sets documentDate to today', () => {
    const form = buildInitialForm('SALE_INVOICE')
    expect(form.documentDate).toBeTruthy()
    // Should be a valid date string
    expect(new Date(form.documentDate).toString()).not.toBe('Invalid Date')
  })
})

// ─── validateInvoiceForm ──────────────────────────────────────────────────────

describe('validateInvoiceForm', () => {
  const validForm: DocumentFormData = {
    type: 'SALE_INVOICE',
    status: 'DRAFT',
    partyId: 'party-1',
    documentDate: '2026-03-18',
    paymentTerms: 'COD',
    dueDate: undefined,
    shippingAddressId: null,
    notes: '',
    termsAndConditions: '',
    vehicleNumber: '',
    includeSignature: false,
    lineItems: [{ productId: 'p1', quantity: 2, rate: 10000, discountType: 'PERCENTAGE', discountValue: 0, taxCategoryId: null, hsnCode: '' }],
    additionalCharges: [],
    transportDetails: null,
    taxPricingMode: 'EXCLUSIVE' as const,
    isReverseCharge: false,
    supplyType: 'B2C_SMALL',
    payment: { amountReceived: 0, mode: 'CASH', referenceNumber: '' },
  }

  it('returns empty errors for valid form', () => {
    const errors = validateInvoiceForm(validForm, false)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns error when partyId is empty', () => {
    const errors = validateInvoiceForm({ ...validForm, partyId: '' }, false)
    expect(errors.partyId).toBeTruthy()
  })

  it('returns error when documentDate is empty', () => {
    const errors = validateInvoiceForm({ ...validForm, documentDate: '' }, false)
    expect(errors.documentDate).toBeTruthy()
  })

  it('returns error when lineItems is empty', () => {
    const errors = validateInvoiceForm({ ...validForm, lineItems: [] }, false)
    expect(errors.lineItems).toBeTruthy()
  })

  it('validates individual line item fields', () => {
    const badItems = [
      { productId: '', productName: '', quantity: 0, rate: -1, discountType: 'PERCENTAGE' as const, discountValue: 0, taxCategoryId: null, hsnCode: '' },
    ]
    const errors = validateInvoiceForm({ ...validForm, lineItems: badItems }, false)
    expect(errors['lineItems.0.productId']).toBeTruthy()
    expect(errors['lineItems.0.quantity']).toBeTruthy()
    expect(errors['lineItems.0.rate']).toBeTruthy()
  })

  it('returns stock error when hasStockBlocks is true', () => {
    const errors = validateInvoiceForm(validForm, true)
    expect(errors.stock).toBeTruthy()
  })
})

// ─── normalizeFormPayload ─────────────────────────────────────────────────────

describe('normalizeFormPayload', () => {
  const baseForm: DocumentFormData = {
    type: 'SALE_INVOICE',
    status: 'DRAFT',
    partyId: 'p1',
    documentDate: '2026-03-18',
    paymentTerms: 'COD',
    dueDate: undefined,
    shippingAddressId: null,
    notes: '  hello  ',
    termsAndConditions: '  terms  ',
    vehicleNumber: '',
    includeSignature: false,
    lineItems: [],
    additionalCharges: [],
    transportDetails: null,
    taxPricingMode: 'EXCLUSIVE' as const,
    isReverseCharge: false,
    supplyType: 'B2C_SMALL',
    payment: { amountReceived: 0, mode: 'CASH', referenceNumber: '' },
  }

  it('sets status to target status', () => {
    const result = normalizeFormPayload(baseForm, 'SAVED')
    expect(result.status).toBe('SAVED')
  })

  it('trims notes and termsAndConditions', () => {
    const result = normalizeFormPayload(baseForm, 'SAVED')
    expect(result.notes).toBe('hello')
    expect(result.termsAndConditions).toBe('terms')
  })

  it('converts empty strings to undefined', () => {
    const result = normalizeFormPayload({ ...baseForm, notes: '  ', termsAndConditions: '' }, 'SAVED')
    expect(result.notes).toBeUndefined()
    expect(result.termsAndConditions).toBeUndefined()
  })

  it('strips the client-only supplyType key (server derives it)', () => {
    const result = normalizeFormPayload(baseForm, 'SAVED')
    expect('supplyType' in result).toBe(false)
  })

  it('never emits payment (create call site attaches it, never normalize)', () => {
    const result = normalizeFormPayload(
      { ...baseForm, payment: { amountReceived: 5000, mode: 'UPI', referenceNumber: '' } },
      'SAVED',
    )
    expect(result.payment).toBeUndefined()
  })

  it('folds a top-level vehicleNumber into transportDetails and drops the top-level key', () => {
    const result = normalizeFormPayload({ ...baseForm, vehicleNumber: ' mh12ab1234 ' }, 'SAVED')
    expect('vehicleNumber' in result).toBe(false)
    expect(result.transportDetails).toEqual({ vehicleNumber: 'mh12ab1234', driverName: null, transportNotes: null })
  })

  it('leaves transportDetails untouched when no vehicle number is entered', () => {
    const result = normalizeFormPayload({ ...baseForm, vehicleNumber: '' }, 'SAVED')
    expect(result.transportDetails).toBeNull()
  })
})
