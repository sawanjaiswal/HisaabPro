/** Smart inventory (#148) — reorder-suggestion orchestration.
 *
 * Reads recent sale velocity (same bounded groupBy the forecast service
 * uses) and proposes a reorder quantity + value per product. No schema of
 * its own — reuses Product.currentStock / weightedAvgCostPaise / reorderQty. */

import { prisma } from '../../lib/prisma.js'
import { dailyVelocity, daysToStockOut, addDaysIso } from '../analytics/forecast.math.js'
import {
  suggestedReorderQty,
  reorderValuePaise,
  reorderUrgency,
  urgencyRank,
} from './reorder.math.js'
import type { ReorderForecast, ReorderSuggestion } from './reorder.types.js'
import type { ReorderSuggestionQuery } from '../../schemas/reorder.schemas.js'
import type { Prisma } from '@prisma/client'

const SALE_WHERE: Prisma.DocumentWhereInput = {
  type: 'SALE_INVOICE',
  status: { in: ['SAVED', 'SHARED'] },
}

export async function getReorderSuggestions(
  businessId: string,
  query: ReorderSuggestionQuery,
  now: Date = new Date(),
): Promise<ReorderForecast> {
  const { windowDays, leadTimeDays, coverageDays, limit, onlyNeeded } = query
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

  const productIds = [...soldByProduct.keys()]
  if (productIds.length === 0) {
    return emptyForecast(windowDays, leadTimeDays, coverageDays)
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId, isDeleted: false },
    select: {
      id: true,
      name: true,
      sku: true,
      currentStock: true,
      minStockLevel: true,
      reorderQty: true,
      purchasePrice: true,
      weightedAvgCostPaise: true,
      unit: { select: { symbol: true } },
    },
  })

  const items: ReorderSuggestion[] = products.map((p) => {
    const velocity = dailyVelocity(soldByProduct.get(p.id) ?? 0, windowDays)
    const days = daysToStockOut(p.currentStock, velocity)
    const qty = suggestedReorderQty(velocity, leadTimeDays, coverageDays, p.currentStock)
    // weighted-avg cost is authoritative; fall back to static purchase price.
    const wac = Number(p.weightedAvgCostPaise)
    const unitCostPaise = wac > 0 ? wac : (p.purchasePrice ?? 0)
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unitSymbol: p.unit.symbol,
      currentStock: p.currentStock,
      dailyVelocity: Math.round(velocity * 100) / 100,
      daysToStockOut: days,
      stockOutDate: days === null ? null : addDaysIso(now, days),
      minStockLevel: p.minStockLevel,
      manualReorderQty: p.reorderQty,
      suggestedReorderQty: qty,
      unitCostPaise,
      reorderValuePaise: reorderValuePaise(qty, unitCostPaise),
      urgency: reorderUrgency(p.currentStock, days, leadTimeDays, coverageDays),
    }
  })

  const needReorder = items.filter((i) => i.urgency !== 'ok')
  const visible = onlyNeeded ? needReorder : items

  // Most urgent first, then soonest stock-out, then largest reorder value.
  visible.sort((a, b) => {
    const rank = urgencyRank(a.urgency) - urgencyRank(b.urgency)
    if (rank !== 0) return rank
    const av = a.daysToStockOut ?? Number.POSITIVE_INFINITY
    const bv = b.daysToStockOut ?? Number.POSITIVE_INFINITY
    if (av !== bv) return av - bv
    return b.reorderValuePaise - a.reorderValuePaise
  })

  const limited = visible.slice(0, limit)

  return {
    items: limited,
    summary: {
      totalProducts: items.length,
      needReorderCount: needReorder.length,
      totalSuggestedValuePaise: limited.reduce((sum, i) => sum + i.reorderValuePaise, 0),
    },
    windowDays,
    leadTimeDays,
    coverageDays,
  }
}

function emptyForecast(
  windowDays: number,
  leadTimeDays: number,
  coverageDays: number,
): ReorderForecast {
  return {
    items: [],
    summary: { totalProducts: 0, needReorderCount: 0, totalSuggestedValuePaise: 0 },
    windowDays,
    leadTimeDays,
    coverageDays,
  }
}
