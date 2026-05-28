/** Orchestration tests for the reorder service (#148) — velocity join,
 * cost fallback, urgency filter + sort, with Prisma mocked. */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getReorderSuggestions } from '../reorder.service.js'

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    documentLineItem: { groupBy: vi.fn() },
    product: { findMany: vi.fn() },
  },
}))

const { prisma } = await import('../../../lib/prisma.js')
const groupBy = prisma.documentLineItem.groupBy as unknown as ReturnType<typeof vi.fn>
const findMany = prisma.product.findMany as unknown as ReturnType<typeof vi.fn>

const NOW = new Date('2026-05-15T00:00:00Z')
const QUERY = {
  windowDays: 30,
  leadTimeDays: 7,
  coverageDays: 30,
  limit: 50,
  onlyNeeded: true,
}

beforeEach(() => vi.clearAllMocks())

describe('getReorderSuggestions', () => {
  it('computes velocity, suggested qty + value, and sorts most-urgent first', async () => {
    groupBy.mockResolvedValueOnce([
      { productId: 'fast', _sum: { quantity: 300 } }, // 10/day
      { productId: 'slow', _sum: { quantity: 30 } }, //  1/day
    ])
    findMany.mockResolvedValueOnce([
      {
        id: 'fast',
        name: 'Fast mover',
        sku: 'F1',
        currentStock: 50, // 5 days left → critical
        minStockLevel: 10,
        reorderQty: 100,
        purchasePrice: 4000,
        weightedAvgCostPaise: 5000n,
        unit: { symbol: 'pcs' },
      },
      {
        id: 'slow',
        name: 'Slow mover',
        sku: 'S1',
        currentStock: 300, // 300 days left → ok (filtered out)
        minStockLevel: 5,
        reorderQty: null,
        purchasePrice: 2000,
        weightedAvgCostPaise: 0n,
        unit: { symbol: 'pcs' },
      },
    ])

    const result = await getReorderSuggestions('biz-1', QUERY, NOW)

    // onlyNeeded → slow mover (ok) is excluded
    expect(result.items).toHaveLength(1)
    const fast = result.items[0]
    expect(fast.productId).toBe('fast')
    expect(fast.dailyVelocity).toBe(10)
    expect(fast.daysToStockOut).toBe(5)
    expect(fast.urgency).toBe('critical')
    // target = 10×(7+30)=370, have 50 → 320; value = 320×5000 (WAC wins)
    expect(fast.suggestedReorderQty).toBe(320)
    expect(fast.unitCostPaise).toBe(5000)
    expect(fast.reorderValuePaise).toBe(1_600_000)

    expect(result.summary.totalProducts).toBe(2)
    expect(result.summary.needReorderCount).toBe(1)
    expect(result.summary.totalSuggestedValuePaise).toBe(1_600_000)
  })

  it('falls back to purchasePrice when weighted-avg cost is zero', async () => {
    groupBy.mockResolvedValueOnce([{ productId: 'p1', _sum: { quantity: 60 } }]) // 2/day
    findMany.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'No WAC',
        sku: null,
        currentStock: 0, // out of stock
        minStockLevel: 0,
        reorderQty: null,
        purchasePrice: 2500,
        weightedAvgCostPaise: 0n,
        unit: { symbol: 'kg' },
      },
    ])

    const result = await getReorderSuggestions('biz-1', QUERY, NOW)
    expect(result.items[0].urgency).toBe('out')
    expect(result.items[0].unitCostPaise).toBe(2500)
  })

  it('returns empty when nothing sold in the window', async () => {
    groupBy.mockResolvedValueOnce([])
    const result = await getReorderSuggestions('biz-1', QUERY, NOW)
    expect(result.items).toEqual([])
    expect(result.summary.totalProducts).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('includes ok products when onlyNeeded is false', async () => {
    groupBy.mockResolvedValueOnce([{ productId: 'slow', _sum: { quantity: 30 } }])
    findMany.mockResolvedValueOnce([
      {
        id: 'slow',
        name: 'Slow mover',
        sku: 'S1',
        currentStock: 300,
        minStockLevel: 5,
        reorderQty: null,
        purchasePrice: 2000,
        weightedAvgCostPaise: 0n,
        unit: { symbol: 'pcs' },
      },
    ])

    const result = await getReorderSuggestions('biz-1', { ...QUERY, onlyNeeded: false }, NOW)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].urgency).toBe('ok')
    expect(result.items[0].suggestedReorderQty).toBe(0)
  })
})
