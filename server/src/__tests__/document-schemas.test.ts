/**
 * Document schemas — line-item nullability contract.
 *
 * The invoice form models "no tax category" / "no HSN" as `null` (that is what
 * the columns hold, and what the product schemas already accept), and posts the
 * line verbatim. If the document schema only tolerates `undefined`, every save
 * from a business whose products are untagged is rejected with a 400 the seller
 * only sees as "nothing happened".
 */

import { describe, it, expect } from 'vitest'
import { createDocumentSchema } from '../schemas/document.schemas.js'

const base = {
  type: 'SALE_INVOICE',
  status: 'SAVED',
  partyId: 'party_1',
  documentDate: '2026-07-26',
}

describe('createDocumentSchema line items', () => {
  it('accepts a line whose optional GST fields are null', () => {
    const parsed = createDocumentSchema.safeParse({
      ...base,
      lineItems: [
        {
          productId: 'prod_1',
          quantity: 3,
          rate: 25000,
          taxCategoryId: null,
          hsnCode: null,
          sacCode: null,
        },
      ],
    })

    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  })

  it('still rejects a wrong type in those fields', () => {
    const parsed = createDocumentSchema.safeParse({
      ...base,
      lineItems: [{ productId: 'prod_1', quantity: 1, rate: 100, taxCategoryId: 42 }],
    })

    expect(parsed.success).toBe(false)
  })
})
