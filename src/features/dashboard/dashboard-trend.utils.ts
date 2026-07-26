/** Dashboard trend → view models for the hero tiles and the overview carousel.
 *
 * Pure: server numbers in, render-ready rows out. Every value here is money the
 * business actually moved; nothing is invented, and a metric with no basis for
 * comparison carries `deltaPct: null` so the UI shows no chip rather than a
 * made-up percentage.
 *
 * All amounts in PAISE.
 */

import type { DashboardTrend, MetricTile, OverviewCard } from './dashboard.types'

/**
 * Hero tiles: what came in, what went out, and what is in the drawer.
 *
 * There is no profit tile. Profit needs cost of goods sold, which the product
 * does not track yet — an "estimate" derived from nothing is the exact class of
 * number a shopkeeper would make a decision on and be wrong.
 */
export function buildMetricTiles(trend: DashboardTrend): MetricTile[] {
  return [
    {
      id: 'collections',
      labelKey: 'collections',
      icon: 'Wallet',
      amount: trend.collections.total,
      deltaPct: trend.collections.deltaPct,
      tone: 'teal',
    },
    {
      id: 'cash',
      labelKey: 'cashInHand',
      icon: 'Landmark',
      amount: trend.cashInHand,
      // Cash in hand is a balance, not a flow — there is no prior window to
      // compare it against, so it shows a status pill instead of a delta.
      deltaPct: null,
      ...(trend.cashInHand > 0 ? { statusKey: 'statusGood' as const } : {}),
      tone: 'success',
    },
    {
      id: 'expenses',
      labelKey: 'expenses',
      icon: 'Receipt',
      amount: trend.expenses.total,
      deltaPct: trend.expenses.deltaPct,
      tone: 'coral',
      hidden: true,
    },
  ]
}

export function buildOverviewCards(trend: DashboardTrend): OverviewCard[] {
  return [
    {
      id: 'sales',
      labelKey: 'totalSales',
      amount: trend.sales.total,
      deltaPct: trend.sales.deltaPct,
      series: trend.sales.series,
      positive: true,
    },
    {
      id: 'collections',
      labelKey: 'collections',
      amount: trend.collections.total,
      deltaPct: trend.collections.deltaPct,
      series: trend.collections.series,
      positive: true,
    },
    {
      // More money going out is not good news, so the card is coloured by the
      // meaning of the movement, not by its sign.
      id: 'expenses',
      labelKey: 'expenses',
      amount: trend.expenses.total,
      deltaPct: trend.expenses.deltaPct,
      series: trend.expenses.series,
      positive: false,
    },
  ]
}
