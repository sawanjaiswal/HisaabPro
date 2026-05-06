/**
 * INV-04 — Stock Value Report Service Tests
 *
 * Tests getStockValueReport:
 *   - Empty result when no products
 *   - lineValuePaise = currentStock × weightedAvgCostPaise
 *   - Ordered by lineValuePaise DESC, id ASC
 *   - Cursor pagination: nextCursor set when hasMore, absent on last page
 *   - Products with weightedAvgCostPaise=0 included (value=0)
 *   - totalValuePaise equals sum of all line values (BigInt safe)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}))

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    product: { findMany: mockFindMany },
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { getStockValueReport } from '../value-report.service.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeProduct(
  id: string,
  name: string,
  currentStock: number,
  weightedAvgCostPaise: bigint,
  sku: string | null = null
) {
  return { id, name, sku, currentStock, weightedAvgCostPaise }
}

const BIZ = 'biz-1'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getStockValueReport — empty case', () => {
  it('returns empty result with zero totals when no products', async () => {
    mockFindMany.mockResolvedValue([])
    const report = await getStockValueReport(BIZ)

    expect(report.items).toEqual([])
    expect(report.totalValuePaise).toBe(BigInt(0))
    expect(report.productCount).toBe(0)
    expect(report.nextCursor).toBeNull()
  })
})

describe('getStockValueReport — weighted-avg formula', () => {
  it('computes lineValuePaise = currentStock × weightedAvgCostPaise', async () => {
    mockFindMany.mockResolvedValue([
      makeProduct('p1', 'Rice 5kg', 10, BigInt(5000)), // 10 × 5000 = 50000
    ])

    const report = await getStockValueReport(BIZ)

    expect(report.items).toHaveLength(1)
    expect(report.items[0].lineValuePaise).toBe(BigInt(50000))
    expect(report.totalValuePaise).toBe(BigInt(50000))
  })

  it('handles product with zero weighted-avg cost (value = 0)', async () => {
    mockFindMany.mockResolvedValue([
      makeProduct('p1', 'Free Gift', 5, BigInt(0)),
    ])

    const report = await getStockValueReport(BIZ)

    expect(report.items[0].lineValuePaise).toBe(BigInt(0))
    expect(report.totalValuePaise).toBe(BigInt(0))
  })
})

describe('getStockValueReport — ordering', () => {
  it('orders results by lineValuePaise DESC', async () => {
    mockFindMany.mockResolvedValue([
      makeProduct('p1', 'Cheap Item', 10, BigInt(100)),     // lineValue = 1000
      makeProduct('p2', 'Expensive Item', 5, BigInt(5000)), // lineValue = 25000
      makeProduct('p3', 'Mid Item', 8, BigInt(500)),        // lineValue = 4000
    ])

    const report = await getStockValueReport(BIZ)

    expect(report.items[0].productId).toBe('p2') // 25000 highest
    expect(report.items[1].productId).toBe('p3') // 4000
    expect(report.items[2].productId).toBe('p1') // 1000
  })

  it('breaks ties by productId ASC', async () => {
    mockFindMany.mockResolvedValue([
      makeProduct('p2', 'Item B', 10, BigInt(100)), // lineValue = 1000
      makeProduct('p1', 'Item A', 10, BigInt(100)), // lineValue = 1000
    ])

    const report = await getStockValueReport(BIZ)

    expect(report.items[0].productId).toBe('p1') // p1 < p2 alphabetically
    expect(report.items[1].productId).toBe('p2')
  })
})

describe('getStockValueReport — pagination', () => {
  it('sets nextCursor when more results exist', async () => {
    mockFindMany.mockResolvedValue([
      makeProduct('p1', 'A', 10, BigInt(500)), // 5000
      makeProduct('p2', 'B', 8, BigInt(400)),  // 3200
      makeProduct('p3', 'C', 6, BigInt(300)),  // 1800
    ])

    const report = await getStockValueReport(BIZ, { limit: 2 })

    expect(report.items).toHaveLength(2)
    expect(report.nextCursor).not.toBeNull()
  })

  it('returns null nextCursor on last page', async () => {
    mockFindMany.mockResolvedValue([
      makeProduct('p1', 'A', 10, BigInt(500)),
      makeProduct('p2', 'B', 8, BigInt(400)),
    ])

    const report = await getStockValueReport(BIZ, { limit: 5 })

    expect(report.items).toHaveLength(2)
    expect(report.nextCursor).toBeNull()
  })

  it('respects cursor to fetch next page', async () => {
    const products = [
      makeProduct('p1', 'A', 10, BigInt(500)), // 5000
      makeProduct('p2', 'B', 8, BigInt(400)),  // 3200
      makeProduct('p3', 'C', 6, BigInt(300)),  // 1800
    ]
    mockFindMany.mockResolvedValue(products)

    // First page (limit=1)
    const page1 = await getStockValueReport(BIZ, { limit: 1 })
    expect(page1.items[0].productId).toBe('p1')
    expect(page1.nextCursor).not.toBeNull()

    // Second page using cursor
    mockFindMany.mockResolvedValue(products)
    const page2 = await getStockValueReport(BIZ, { limit: 1, cursor: page1.nextCursor! })
    expect(page2.items[0].productId).toBe('p2')
  })
})

describe('getStockValueReport — totalValuePaise', () => {
  it('sums all products (BigInt safe for large values)', async () => {
    // Simulate large values that would overflow Number/int32
    const bigCost = BigInt('999999999999') // ~10 billion paise
    mockFindMany.mockResolvedValue([
      makeProduct('p1', 'Gold', 1000, bigCost),
      makeProduct('p2', 'Silver', 500, BigInt('100000')),
    ])

    const report = await getStockValueReport(BIZ)

    const expected = BigInt(1000) * bigCost + BigInt(500) * BigInt('100000')
    expect(report.totalValuePaise).toBe(expected)
  })
})
