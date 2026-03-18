import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useInvoiceCalculations } from '../useInvoiceCalculations'
import type { LineItemCalc, ChargeCalc } from '../invoice-calc.utils'

describe('useInvoiceCalculations', () => {
  const singleItem: LineItemCalc[] = [{
    quantity: 2,
    ratePaise: 50000,       // Rs 500
    discountType: 'PERCENTAGE',
    discountValue: 10,
    purchasePricePaise: 30000, // Rs 300
  }]

  it('calculates single line item', () => {
    const { result } = renderHook(() =>
      useInvoiceCalculations(singleItem, []),
    )
    // 2 × 50000 = 100000, 10% discount = 10000, lineTotal = 90000
    expect(result.current.lineCalculations[0].lineTotal).toBe(90000)
    expect(result.current.lineCalculations[0].discountAmount).toBe(10000)
  })

  it('calculates profit', () => {
    const { result } = renderHook(() =>
      useInvoiceCalculations(singleItem, []),
    )
    // Profit: sale rate - purchase rate per unit, adjusted for qty and discount
    expect(result.current.lineCalculations[0].profit).toBeGreaterThan(0)
  })

  it('calculates subtotal', () => {
    const { result } = renderHook(() =>
      useInvoiceCalculations(singleItem, []),
    )
    expect(result.current.subtotal).toBe(90000)
  })

  it('includes additional charges', () => {
    const charges: ChargeCalc[] = [
      { type: 'FIXED', value: 5000 }, // Rs 50 flat
    ]
    const { result } = renderHook(() =>
      useInvoiceCalculations(singleItem, charges),
    )
    expect(result.current.totalCharges).toBe(5000)
    expect(result.current.grandTotal).toBe(85000) // 90000 - 10000 discount + 5000 charge
  })

  it('handles percentage charge', () => {
    const charges: ChargeCalc[] = [
      { type: 'PERCENTAGE', value: 10 }, // 10%
    ]
    const { result } = renderHook(() =>
      useInvoiceCalculations(singleItem, charges),
    )
    expect(result.current.totalCharges).toBeGreaterThan(0)
  })

  it('handles empty line items', () => {
    const { result } = renderHook(() =>
      useInvoiceCalculations([], []),
    )
    expect(result.current.subtotal).toBe(0)
    expect(result.current.grandTotal).toBe(0)
    expect(result.current.lineCalculations).toHaveLength(0)
  })

  it('handles round off setting', () => {
    const { result } = renderHook(() =>
      useInvoiceCalculations(singleItem, [], 'NEAREST_1'),
    )
    // Grand total should be a whole number
    expect(result.current.grandTotal % 100).toBe(0) // paise, so nearest rupee = divisible by 100
  })

  it('calculates multiple line items', () => {
    const items: LineItemCalc[] = [
      { quantity: 1, ratePaise: 10000, discountType: 'PERCENTAGE', discountValue: 0, purchasePricePaise: 0 },
      { quantity: 3, ratePaise: 20000, discountType: 'PERCENTAGE', discountValue: 0, purchasePricePaise: 0 },
    ]
    const { result } = renderHook(() =>
      useInvoiceCalculations(items, []),
    )
    expect(result.current.lineCalculations).toHaveLength(2)
    expect(result.current.subtotal).toBe(70000) // 10000 + 60000
  })
})
