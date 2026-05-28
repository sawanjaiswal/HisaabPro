/**
 * Predictive analytics (#146) — orchestration. Reads existing sales history
 * (no schema of its own) and runs the pure stats in forecast.math.ts.
 *
 * Revenue history is built from bounded per-month aggregates (≤24 indexed
 * queries on [businessId, type, status, documentDate]) rather than pulling
 * every invoice into memory. Stock velocity uses a single grouped aggregate.
 */

import { prisma } from '../../lib/prisma.js'
import {
  projectLinear,
  percentChange,
  dailyVelocity,
  daysToStockOut,
  addDaysIso,
} from './forecast.math.js'
import type {
  RevenueForecast,
  RevenuePoint,
  StockForecast,
  StockForecastItem,
} from './forecast.types.js'
import type { RevenueForecastQuery, StockForecastQuery } from '../../schemas/analytics.schemas.js'
import type { Prisma } from '@prisma/client'

const SALE_WHERE: Prisma.DocumentWhereInput = {
  type: 'SALE_INVOICE',
  status: { in: ['SAVED', 'SHARED'] },
}

/** First day of the month, `offset` months before `ref`, at UTC midnight. */
function monthStart(ref: Date, offset: number): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - offset, 1))
}

export async function getRevenueForecast(
  businessId: string,
  query: RevenueForecastQuery,
  now: Date = new Date()
): Promise<RevenueForecast> {
  const { months, horizon } = query

  // Build the [oldest … current] month boundaries, then aggregate each bucket.
  const bounds: Date[] = []
  for (let i = months - 1; i >= 0; i--) bounds.push(monthStart(now, i))
  const nextBoundary = monthStart(now, -1) // start of the month after current

  const sums = await Promise.all(
    bounds.map((start, idx) => {
      const end = idx + 1 < bounds.length ? bounds[idx + 1] : nextBoundary
      return prisma.document.aggregate({
        where: { businessId, ...SALE_WHERE, documentDate: { gte: start, lt: end } },
        _sum: { grandTotal: true },
      })
    })
  )

  const history = sums.map((s) => s._sum.grandTotal ?? 0)
  const projected = projectLinear(history, horizon)

  const points: RevenuePoint[] = bounds.map((start, idx) => ({
    month: start.toISOString().slice(0, 10),
    revenuePaise: history[idx],
    projected: false,
  }))
  for (let i = 0; i < projected.length; i++) {
    points.push({
      month: monthStart(now, -(i + 1)).toISOString().slice(0, 10),
      revenuePaise: projected[i],
      projected: true,
    })
  }

  const lastObserved = history[history.length - 1] ?? 0
  const nextMonthPaise = projected[0] ?? 0

  return {
    points,
    nextMonthPaise,
    momChangePct: percentChange(lastObserved, nextMonthPaise),
    basisMonths: months,
  }
}

export async function getStockForecast(
  businessId: string,
  query: StockForecastQuery,
  now: Date = new Date()
): Promise<StockForecast> {
  const { windowDays, horizonDays, limit } = query
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)

  // Units sold per product over the window (sale invoices only).
  const sold = await prisma.documentLineItem.groupBy({
    by: ['productId'],
    where: {
      document: { businessId, ...SALE_WHERE, documentDate: { gte: windowStart, lte: now } },
    },
    _sum: { quantity: true },
  })

  const soldByProduct = new Map<string, number>()
  for (const row of sold) {
    if (row.productId) soldByProduct.set(row.productId, row._sum.quantity ?? 0)
  }

  // Only inventory-tracked products that have moved are forecastable.
  const productIds = [...soldByProduct.keys()]
  if (productIds.length === 0) {
    return { items: [], windowDays, horizonDays }
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId, deletedAt: null },
    select: { id: true, name: true, currentStock: true },
  })

  const items: StockForecastItem[] = products.map((p) => {
    const velocity = dailyVelocity(soldByProduct.get(p.id) ?? 0, windowDays)
    const days = daysToStockOut(p.currentStock, velocity)
    return {
      productId: p.id,
      name: p.name,
      currentStock: p.currentStock,
      dailyVelocity: Math.round(velocity * 100) / 100,
      daysToStockOut: days,
      stockOutDate: days === null ? null : addDaysIso(now, days),
      reorderSoon: days !== null && days <= horizonDays,
    }
  })

  // Soonest stock-out first; products with no projected stock-out sink last.
  items.sort((a, b) => {
    const av = a.daysToStockOut ?? Number.POSITIVE_INFINITY
    const bv = b.daysToStockOut ?? Number.POSITIVE_INFINITY
    return av - bv
  })

  return { items: items.slice(0, limit), windowDays, horizonDays }
}
