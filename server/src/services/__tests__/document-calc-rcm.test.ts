/**
 * Reverse charge and the bill.
 *
 * Under RCM the recipient pays the GST straight to the government, so the
 * supplier's invoice collects none of it. The tax heads going to zero is only
 * half of that — the amount the customer owes has to drop by the same money, or
 * the receivable and the revenue no longer agree and the GL entry is unbalanced.
 */

import { describe, it, expect } from 'vitest'
import { calculateDocumentTotals } from '../document-calc.js'

const line = {
  quantity: 1,
  rate: 100000, // Rs 1,000
  discountType: 'AMOUNT',
  discountValue: 0,
  purchasePrice: 0,
  gstRate: 1800,
}

describe('calculateDocumentTotals — reverse charge', () => {
  it('bills the taxable value only', () => {
    const totals = calculateDocumentTotals([line], [], 'NEAREST_1', {
      businessStateCode: '27',
      placeOfSupply: '27',
      isReverseCharge: true,
    })

    expect(totals.subtotal).toBe(100000)
    expect(totals.totalTax, 'the supplier collects no tax under RCM').toBe(0)
    expect(totals.totalCgst).toBe(0)
    expect(totals.totalSgst).toBe(0)
    expect(
      totals.grandTotal,
      'the customer owes the taxable value — a grandTotal carrying tax nobody collected unbalances the GL entry',
    ).toBe(100000)
  })

  it('still charges the tax when reverse charge is off', () => {
    const totals = calculateDocumentTotals([line], [], 'NEAREST_1', {
      businessStateCode: '27',
      placeOfSupply: '27',
    })

    expect(totals.totalTax).toBe(18000)
    expect(totals.grandTotal).toBe(118000)
  })

  it('keeps the line-level tax for the return even though none is collected', () => {
    const totals = calculateDocumentTotals([line], [], 'NEAREST_1', {
      businessStateCode: '27',
      placeOfSupply: '27',
      isReverseCharge: true,
    })

    // GSTR-1 reports an RCM supply with its rate and taxable value; wiping the
    // line amounts would leave nothing to file.
    const [row] = totals.lineResults
    expect(Number(row!.cgstAmount) + Number(row!.sgstAmount)).toBe(18000)
  })
})
