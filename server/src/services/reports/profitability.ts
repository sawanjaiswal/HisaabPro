/**
 * Profitability Report — Revenue vs Cost analysis grouped by Party, Product, or Document
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { REPORT_ROW_LIMIT } from './helpers.js'

export async function getProfitabilityReport(
  businessId: string,
  from: Date,
  to: Date,
  groupBy: 'PARTY' | 'PRODUCT' | 'DOCUMENT',
) {
  type ProfitItem = {
    id: string
    name: string
    revenue: number
    cost: number
    profit: number
    profitPercent: number
  }

  const items: ProfitItem[] = []

  if (groupBy === 'PARTY') {
    const docs = await prisma.document.findMany({
      where: {
        businessId,
        type: 'SALE_INVOICE',
        status: { not: 'DELETED' },
        documentDate: { gte: from, lte: to },
      },
      select: {
        partyId: true,
        grandTotal: true,
        totalCost: true,
        totalProfit: true,
        party: { select: { id: true, name: true } },
      },
      take: REPORT_ROW_LIMIT,
    })

    if (docs.length === REPORT_ROW_LIMIT) {
      logger.warn('getProfitabilityReport(PARTY): result set capped at limit', { businessId, limit: REPORT_ROW_LIMIT })
    }

    const partyMap = new Map<
      string,
      { name: string; revenue: number; cost: number }
    >()

    for (const doc of docs) {
      const existing = partyMap.get(doc.partyId)
      if (existing) {
        existing.revenue += doc.grandTotal
        existing.cost += doc.totalCost
      } else {
        partyMap.set(doc.partyId, {
          name: doc.party.name,
          revenue: doc.grandTotal,
          cost: doc.totalCost,
        })
      }
    }

    for (const [id, v] of partyMap.entries()) {
      const profit = v.revenue - v.cost
      items.push({
        id,
        name: v.name,
        revenue: v.revenue,
        cost: v.cost,
        profit,
        profitPercent: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
      })
    }
  } else if (groupBy === 'PRODUCT') {
    const lineItems = await prisma.documentLineItem.findMany({
      where: {
        document: {
          businessId,
          type: 'SALE_INVOICE',
          status: { not: 'DELETED' },
          documentDate: { gte: from, lte: to },
        },
      },
      select: {
        productId: true,
        lineTotal: true,
        purchasePrice: true,
        quantity: true,
        product: { select: { id: true, name: true } },
      },
      take: REPORT_ROW_LIMIT,
    })

    if (lineItems.length === REPORT_ROW_LIMIT) {
      logger.warn('getProfitabilityReport(PRODUCT): result set capped at limit', { businessId, limit: REPORT_ROW_LIMIT })
    }

    const productMap = new Map<
      string,
      { name: string; revenue: number; cost: number }
    >()

    for (const li of lineItems) {
      const cost = Math.round(li.purchasePrice * li.quantity)
      const existing = productMap.get(li.productId)
      if (existing) {
        existing.revenue += li.lineTotal
        existing.cost += cost
      } else {
        productMap.set(li.productId, {
          name: li.product.name,
          revenue: li.lineTotal,
          cost,
        })
      }
    }

    for (const [id, v] of productMap.entries()) {
      const profit = v.revenue - v.cost
      items.push({
        id,
        name: v.name,
        revenue: v.revenue,
        cost: v.cost,
        profit,
        profitPercent: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
      })
    }
  } else {
    // DOCUMENT
    const docs = await prisma.document.findMany({
      where: {
        businessId,
        type: 'SALE_INVOICE',
        status: { not: 'DELETED' },
        documentDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        documentNumber: true,
        grandTotal: true,
        totalCost: true,
        totalProfit: true,
        profitPercent: true,
      },
      take: REPORT_ROW_LIMIT,
    })

    if (docs.length === REPORT_ROW_LIMIT) {
      logger.warn('getProfitabilityReport(DOCUMENT): result set capped at limit', { businessId, limit: REPORT_ROW_LIMIT })
    }

    for (const doc of docs) {
      items.push({
        id: doc.id,
        name: doc.documentNumber ?? doc.id,
        revenue: doc.grandTotal,
        cost: doc.totalCost,
        profit: doc.totalProfit,
        profitPercent: doc.profitPercent,
      })
    }
  }

  // Sort by revenue descending
  items.sort((a, b) => b.revenue - a.revenue)

  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0)
  const totalCost = items.reduce((s, i) => s + i.cost, 0)
  const totalProfit = totalRevenue - totalCost

  return {
    groupBy,
    period: { from, to },
    items,
    totals: {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      profitPercent: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    },
  }
}
