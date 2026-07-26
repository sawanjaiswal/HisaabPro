import { describe, it, expect } from 'vitest'
import {
  calculateLineProfit,
  calculateInvoiceTotals,
} from '../invoice-totals.utils'
import type { LineItemCalc, ChargeCalc } from '../invoice-calc.utils'

// ─── Line profit ─────────────────────────────────────────────────────────────

describe('calculateLineProfit', () => {
  it('calculates positive profit', () => {
    const result = calculateLineProfit(10000, 6000, 5, 0)
    expect(result.profit).toBe(20000)
    expect(result.profitPercent).toBe(40)
  })

  it('calculates negative profit (loss)', () => {
    const result = calculateLineProfit(5000, 8000, 2, 0)
    expect(result.profit).toBe(-6000)
  })

  it('handles zero lineTotal', () => {
    const result = calculateLineProfit(0, 0, 0, 0)
    expect(result.profitPercent).toBe(0)
  })
})

// ─── Invoice totals orchestrator ─────────────────────────────────────────────

describe('calculateInvoiceTotals', () => {
  const lineItems: LineItemCalc[] = [
    { quantity: 2, ratePaise: 100000, discountType: 'PERCENTAGE', discountValue: 10, purchasePricePaise: 60000 },
    { quantity: 1, ratePaise: 50000, discountType: 'AMOUNT', discountValue: 5000, purchasePricePaise: 30000 },
  ]
  const charges: ChargeCalc[] = [
    { type: 'FIXED', value: 10000 },
  ]

  // Regression: `calculateSubtotal` already nets off the per-line discounts, so
  // handing that same figure to `calculateGrandTotal` — which subtracts the
  // discount again — under-billed every discounted invoice by the discount. The
  // server (document-calc.ts) charges subtotal + charges + tax, and the bill the
  // seller reads out has to be the bill that gets stored.
  it('does not subtract the line discounts twice', () => {
    const totals = calculateInvoiceTotals(lineItems, charges, 'NONE')
    expect(totals.grandTotal).toBe(totals.subtotal + totals.totalCharges + totals.roundOff)
  })

  it('computes all fields', () => {
    const totals = calculateInvoiceTotals(lineItems, charges, 'NONE')
    expect(totals.subtotal).toBe(225000) // (180000 + 45000)
    expect(totals.totalDiscount).toBe(25000) // (20000 + 5000)
    expect(totals.totalCharges).toBe(10000)
    expect(totals.roundOff).toBe(0)
    expect(totals.grandTotal).toBe(235000) // 225000 net of discount + 10000 charge
  })

  it('applies round-off', () => {
    const totals = calculateInvoiceTotals(lineItems, charges, 'NEAREST_1')
    expect(totals.roundOff).toBe(0) // 210000 is already rounded to ₹
  })

  // Regression: the screen quoted a GST invoice at its pre-tax amount while the
  // server stored (and the customer was billed) the taxed one — the totals
  // orchestrator had no tax input at all.
  it('bills the tax the document carries', () => {
    const totals = calculateInvoiceTotals(lineItems, charges, 'NONE', 42300)
    expect(totals.totalTax).toBe(42300)
    expect(totals.grandTotal).toBe(225000 + 10000 + 42300)
  })

  it('rounds off the taxed total, not the pre-tax one', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, ratePaise: 100000, discountType: 'PERCENTAGE', discountValue: 0, purchasePricePaise: 0 }],
      [], 'NEAREST_1', 12345,
    )
    // 100000 + 12345 = 112345 → nearest rupee is 112300
    expect(totals.roundOff).toBe(-45)
    expect(totals.grandTotal).toBe(112300)
  })

  it('handles empty items', () => {
    const totals = calculateInvoiceTotals([], [], 'NONE')
    expect(totals.grandTotal).toBe(0)
    expect(totals.profitPercent).toBe(0)
  })
})
