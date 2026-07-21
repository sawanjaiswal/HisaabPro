/**
 * The stock cap in usePosCart reads `product.stock`. The server sends
 * `currentStock` — so the guard compared against `undefined` and never fired,
 * letting a cashier oversell. This is the quiet half of the same contract bug.
 *
 * Trace: .claude/fix-trace-pos-contract.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePosCart } from '../usePosCart'
import type { QuickProduct } from '../pos.types'

const warn = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ warning: warn, success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      posOnlyXInStock: 'Only {count} in stock',
      posMaxItems: 'Max {count} items',
    },
  }),
}))

/** Two units on hand — the third add must be refused. */
const lowStockProduct: QuickProduct = {
  id: 'prod-1',
  name: 'Tata Salt 1kg',
  sku: 'TS-1KG',
  salePrice: 2800,
  currentStock: 2,
}

beforeEach(() => {
  sessionStorage.clear()
  warn.mockReset()
})

describe('usePosCart stock cap', () => {
  it('refuses to add more units than the product has in stock', () => {
    const { result } = renderHook(() => usePosCart())

    act(() => { result.current.addItem(lowStockProduct) })
    act(() => { result.current.addItem(lowStockProduct) })
    act(() => { result.current.addItem(lowStockProduct) })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(2)
  })

  it('caps updateQty at the available stock', () => {
    const { result } = renderHook(() => usePosCart())

    act(() => { result.current.addItem(lowStockProduct) })
    act(() => { result.current.updateQty('prod-1', 99) })

    expect(result.current.items[0].quantity).toBe(2)
  })
})
