/**
 * Contract test for GET /api/pos/products → cart.
 *
 * `wireProduct` below is copied from the server's own PosProductDTO
 * (server/src/services/pos/pos-products.service.ts:123). The client type used
 * to declare `salePrice` / `stock` / `unit` / `taxRate` instead, which rendered
 * ₹NaN and "Stock: undefined".
 *
 * The gstRate assertion is the important one: the wire carries BASIS POINTS
 * (schema.prisma:1978 — 1800 = 18.00%) while the cart maths divides by 100.
 * Renaming the field without converting would have silently taxed every line
 * 100x instead of crashing.
 *
 * Trace: .claude/fix-trace-pos-contract.md
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { usePosStore } from '../state/pos.store'
import type { PosProductDTO } from '../types/pos.types'

const wireProduct: PosProductDTO = {
  id: 'prod-1',
  name: 'Tata Salt 1kg',
  sku: 'TS-1KG',
  hsnCode: '25010010',
  categoryId: 'cat-1',
  categoryName: 'Grocery',
  unitId: 'unit-1',
  unitSymbol: 'pc',
  salePricePaise: 10000,
  currentStock: 2,
  taxCategoryId: 'tax-18',
  gstRate: 1800, // basis points = 18%
  imageUrl: null,
}

beforeEach(() => {
  usePosStore.setState({ items: [], payments: [] })
})

describe('pos store — /pos/products contract', () => {
  it('maps the wire product onto a cart line', () => {
    usePosStore.getState().addItem(wireProduct)

    const [line] = usePosStore.getState().items
    expect(line.unitPrice).toBe(10000)
    expect(line.stock).toBe(2)
    expect(line.unit).toBe('pc')
  })

  it('converts gstRate from basis points to percent', () => {
    usePosStore.getState().addItem(wireProduct)

    expect(usePosStore.getState().items[0].taxRate).toBe(18)
  })

  it('charges 18% tax on a ₹100 line, not 1800%', () => {
    usePosStore.getState().addItem(wireProduct)

    // ₹100.00 = 10000 paise → ₹18.00 tax = 1800 paise
    expect(usePosStore.getState().totals.totalTax).toBe(1800)
  })

  it('refuses to add past the available stock', () => {
    const store = usePosStore.getState()
    store.addItem(wireProduct)
    store.addItem(wireProduct)
    const third = usePosStore.getState().addItem(wireProduct)

    expect(third).toEqual({ ok: false, reason: 'stock_limit' })
    expect(usePosStore.getState().items[0].quantity).toBe(2)
  })
})
