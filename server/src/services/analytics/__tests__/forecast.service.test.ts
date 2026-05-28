/**
 * Orchestration tests for the forecast service — month-boundary bucketing,
 * projection wiring, and stock-out sort/flag logic, with Prisma mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRevenueForecast, getStockForecast } from '../forecast.service.js'

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    document: { aggregate: vi.fn() },
    documentLineItem: { groupBy: vi.fn() },
    product: { findMany: vi.fn() },
  },
}))

const { prisma } = await import('../../../lib/prisma.js')
const aggregate = prisma.document.aggregate as unknown as ReturnType<typeof vi.fn>
const groupBy = prisma.documentLineItem.groupBy as unknown as ReturnType<typeof vi.fn>
const findMany = prisma.product.findMany as unknown as ReturnType<typeof vi.fn>

const NOW = new Date('2026-05-15T00:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRevenueForecast', () => {
  it('builds month buckets, projects forward, and computes MoM change', async () => {
    aggregate
      .mockResolvedValueOnce({ _sum: { grandTotal: 100 } })
      .mockResolvedValueOnce({ _sum: { grandTotal: 200 } })
      .mockResolvedValueOnce({ _sum: { grandTotal: 300 } })

    const result = await getRevenueForecast('biz-1', { months: 3, horizon: 2 }, NOW)

    expect(aggregate).toHaveBeenCalledTimes(3)
    // 3 observed + 2 projected
    expect(result.points).toHaveLength(5)
    expect(result.points.slice(0, 3).map((p) => p.month)).toEqual([
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
    ])
    expect(result.points.slice(0, 3).every((p) => !p.projected)).toBe(true)

    // y = 100x + 100 → x=3 → 400, x=4 → 500
    const projected = result.points.filter((p) => p.projected)
    expect(projected.map((p) => p.revenuePaise)).toEqual([400, 500])
    expect(projected.map((p) => p.month)).toEqual(['2026-06-01', '2026-07-01'])

    expect(result.nextMonthPaise).toBe(400)
    expect(result.momChangePct).toBeCloseTo(33.333, 2)
    expect(result.basisMonths).toBe(3)
  })

  it('treats months with no sales as 0 revenue', async () => {
    aggregate
      .mockResolvedValueOnce({ _sum: { grandTotal: null } })
      .mockResolvedValueOnce({ _sum: { grandTotal: null } })
      .mockResolvedValueOnce({ _sum: { grandTotal: null } })

    const result = await getRevenueForecast('biz-1', { months: 3, horizon: 1 }, NOW)
    expect(result.points.slice(0, 3).every((p) => p.revenuePaise === 0)).toBe(true)
    expect(result.nextMonthPaise).toBe(0)
    expect(result.momChangePct).toBeNull()
  })
})

describe('getStockForecast', () => {
  it('sorts soonest-stock-out first and flags reorder within the horizon', async () => {
    groupBy.mockResolvedValueOnce([
      { productId: 'p2', _sum: { quantity: 30 } },
      { productId: 'p1', _sum: { quantity: 300 } },
    ])
    findMany.mockResolvedValueOnce([
      { id: 'p1', name: 'Fast mover', currentStock: 90 },
      { id: 'p2', name: 'Slow mover', currentStock: 300 },
    ])

    const result = await getStockForecast(
      'biz-1',
      { windowDays: 30, horizonDays: 14, limit: 20 },
      NOW
    )

    expect(result.items.map((i) => i.productId)).toEqual(['p1', 'p2'])
    expect(result.items[0].dailyVelocity).toBe(10)
    expect(result.items[0].daysToStockOut).toBe(9)
    expect(result.items[0].stockOutDate).toBe('2026-05-24')
    expect(result.items[0].reorderSoon).toBe(true)
    expect(result.items[1].daysToStockOut).toBe(300)
    expect(result.items[1].reorderSoon).toBe(false)
  })

  it('short-circuits with no products when nothing sold in the window', async () => {
    groupBy.mockResolvedValueOnce([])
    const result = await getStockForecast(
      'biz-1',
      { windowDays: 30, horizonDays: 14, limit: 20 },
      NOW
    )
    expect(result.items).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})
