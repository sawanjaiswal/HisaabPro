/**
 * Percentage discounts cross the wire in basis points.
 *
 * The form holds what the seller typed (10 = 10%), but the server — and the POS
 * path that writes the same columns — divides by 10,000. Posting the raw percent
 * turns a 10% discount into 0.1%, so the invoice saves a total the seller never
 * saw. These cases pin the conversion at both crossings.
 */

import { describe, it, expect } from 'vitest'
import { normalizeFormPayload, buildInitialForm } from '../invoice-form.utils'
import type { DocumentFormData } from '../invoice-api.types'

function formWith(overrides: Partial<DocumentFormData>): DocumentFormData {
  return { ...buildInitialForm('SALE_INVOICE'), partyId: 'p1', ...overrides }
}

describe('normalizeFormPayload — discount units', () => {
  const line = {
    productId: 'prod_1',
    quantity: 4,
    rate: 10000,
    taxCategoryId: null,
    hsnCode: '',
  }

  it('sends a percentage line discount in basis points', () => {
    const payload = normalizeFormPayload(
      formWith({
        lineItems: [{ ...line, discountType: 'PERCENTAGE', discountValue: 10 }],
      }),
      'SAVED',
    )

    expect(payload.lineItems[0]!.discountValue).toBe(1000)
  })

  it('leaves an absolute line discount in paise', () => {
    const payload = normalizeFormPayload(
      formWith({
        lineItems: [{ ...line, discountType: 'AMOUNT', discountValue: 4000 }],
      }),
      'SAVED',
    )

    expect(payload.lineItems[0]!.discountValue).toBe(4000)
  })

  it('sends a percentage additional charge in basis points, fixed ones in paise', () => {
    const payload = normalizeFormPayload(
      formWith({
        lineItems: [{ ...line, discountType: 'AMOUNT', discountValue: 0 }],
        additionalCharges: [
          { name: 'Packing', type: 'PERCENTAGE', value: 2 },
          { name: 'Freight', type: 'FIXED', value: 5000 },
        ],
      }),
      'SAVED',
    )

    expect(payload.additionalCharges?.[0]!.value).toBe(200)
    expect(payload.additionalCharges?.[1]!.value).toBe(5000)
  })
})
