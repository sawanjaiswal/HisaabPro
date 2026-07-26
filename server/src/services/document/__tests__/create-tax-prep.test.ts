/**
 * The rate a line is taxed at comes from its tax category, not from the client.
 *
 * The invoice form posts `taxCategoryId` and nothing else — the rate is a
 * server-owned fact (TaxCategory.rate) and a client that could state it could
 * bill 0% GST on taxable goods. These cases pin the derivation.
 */

import { describe, it, expect } from 'vitest'
import { buildCalcItems } from '../create-tax-prep.js'

const purchasePrices = new Map<string, number>([['p1', 5000]])
const line = {
  productId: 'p1',
  quantity: 2,
  rate: 100000,
  discountType: 'AMOUNT',
  discountValue: 0,
}

describe('buildCalcItems — GST rate source', () => {
  it('takes the rate from the line\'s tax category', () => {
    const categories = new Map([['tc18', { rate: 1800, cessRate: 0, cessType: 'PERCENTAGE' }]])

    const [item] = buildCalcItems(
      [{ ...line, taxCategoryId: 'tc18' }],
      purchasePrices,
      categories,
      'EXCLUSIVE',
      false,
    )

    expect(item!.gstRate).toBe(1800)
  })

  it('ignores a body-supplied rate that contradicts the category', () => {
    const categories = new Map([['tc18', { rate: 1800, cessRate: 0, cessType: 'PERCENTAGE' }]])

    const [item] = buildCalcItems(
      [{ ...line, taxCategoryId: 'tc18', gstRate: 0 }],
      purchasePrices,
      categories,
      'EXCLUSIVE',
      false,
    )

    expect(item!.gstRate, 'the category is the rate, whatever the client claims').toBe(1800)
  })

  it('leaves an untagged line at no tax', () => {
    const [item] = buildCalcItems(
      [{ ...line, taxCategoryId: null }],
      purchasePrices,
      new Map(),
      'EXCLUSIVE',
      false,
    )

    expect(item!.gstRate).toBe(0)
  })

  it('backs the tax out of the rate when pricing is inclusive', () => {
    const categories = new Map([['tc18', { rate: 1800, cessRate: 0, cessType: 'PERCENTAGE' }]])

    // Rs 1,180 inclusive of 18% is Rs 1,000 taxable — the back-calculation has
    // to see the category's rate too, or it divides by 1 and changes nothing.
    const [item] = buildCalcItems(
      [{ ...line, quantity: 1, rate: 118000, taxCategoryId: 'tc18' }],
      purchasePrices,
      categories,
      'INCLUSIVE',
      false,
    )

    expect(item!.rate).toBe(100000)
    expect(item!.gstRate).toBe(1800)
  })
})
