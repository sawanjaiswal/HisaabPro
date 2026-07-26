import { describe, it, expect } from 'vitest'
import { buildMetricTiles, buildOverviewCards } from '../dashboard-trend.utils'
import type { DashboardTrend } from '../dashboard.types'

const metric = (total: number, previousTotal: number, deltaPct: number | null) => ({
  total,
  previousTotal,
  deltaPct,
  series: Array(30).fill(0),
})

const TREND: DashboardTrend = {
  days: 30,
  sales: metric(500_000, 400_000, 25),
  collections: metric(300_000, 300_000, 0),
  expenses: metric(120_000, 150_000, -20),
  cashInHand: 180_000,
  todayVsYesterday: { today: 20_000, yesterday: 10_000, deltaPct: 100 },
}

describe('buildMetricTiles', () => {
  it('renders only money the business actually moved', () => {
    const tiles = buildMetricTiles(TREND)
    expect(tiles.map((t) => t.id)).toEqual(['collections', 'cash', 'expenses'])
    expect(tiles[0]!.amount).toBe(TREND.collections.total)
    expect(tiles[1]!.amount).toBe(TREND.cashInHand)
    expect(tiles[2]!.amount).toBe(TREND.expenses.total)
  })

  it('has no profit tile — profit needs COGS the product does not track', () => {
    expect(buildMetricTiles(TREND).some((t) => /profit/i.test(t.id))).toBe(false)
  })

  it('shows no "Good" pill when the drawer is empty or negative', () => {
    const broke = buildMetricTiles({ ...TREND, cashInHand: 0 })
    expect(broke.find((t) => t.id === 'cash')!.statusKey).toBeUndefined()
  })
})

describe('buildOverviewCards', () => {
  it('carries the server delta through untouched, including a missing one', () => {
    const cards = buildOverviewCards({ ...TREND, sales: metric(500_000, 0, null) })
    expect(cards.find((c) => c.id === 'sales')!.deltaPct).toBeNull()
    expect(cards.find((c) => c.id === 'expenses')!.deltaPct).toBe(-20)
  })

  it('treats a rise in expenses as bad news, not growth', () => {
    expect(buildOverviewCards(TREND).find((c) => c.id === 'expenses')!.positive).toBe(false)
  })
})
