/**
 * Stock Summary — inventory status, values, and stock health per product.
 */

import { prisma } from '../../lib/prisma.js'
import type { StockSummaryQuery } from '../../schemas/report.schemas.js'

export async function getStockSummary(businessId: string, query: StockSummaryQuery) {
  const { categoryId, stockStatus, search, sortBy, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    status: 'ACTIVE',
  }
  if (categoryId) where.categoryId = categoryId
  if (search) where.name = { contains: search, mode: 'insensitive' }

  // Stock status filters pushed to DB where possible
  if (stockStatus === 'out_of_stock') {
    where.currentStock = { lte: 0 }
  } else if (stockStatus === 'low') {
    // Low stock: currentStock > 0 AND currentStock <= minStockLevel
    // Since Prisma can't compare columns, over-fetch and filter post-query
    where.currentStock = { gt: 0 }
  } else if (stockStatus === 'in_stock') {
    where.currentStock = { gt: 0 }
  }

  const orderField = sortBy.startsWith('name') ? 'name'
    : sortBy.startsWith('stock') ? 'currentStock'
    : 'salePrice'
  const orderDir = sortBy.endsWith('asc') ? 'asc' : 'desc'

  const [products, stats] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true, name: true, currentStock: true, minStockLevel: true,
        purchasePrice: true, salePrice: true,
        category: { select: { name: true } },
        unit: { select: { symbol: true } },
      },
      orderBy: { [orderField]: orderDir },
      // Over-fetch when post-filtering is needed (low/in_stock require column comparison)
      take: (stockStatus === 'low' || stockStatus === 'in_stock') ? limit * 3 : limit,
    }),
    prisma.product.aggregate({
      where: { businessId, status: 'ACTIVE' },
      _count: true,
    }),
  ])

  let totalStockValueAtPurchase = 0
  let totalStockValueAtSale = 0
  let lowStockCount = 0
  let outOfStockCount = 0

  const items = products.map(p => {
    const purchaseVal = Math.round(p.currentStock * (p.purchasePrice || 0))
    const saleVal = Math.round(p.currentStock * p.salePrice)
    totalStockValueAtPurchase += purchaseVal
    totalStockValueAtSale += saleVal

    let status: 'in_stock' | 'low' | 'out_of_stock'
    if (p.currentStock <= 0) {
      status = 'out_of_stock'
      outOfStockCount++
    } else if (p.currentStock <= p.minStockLevel) {
      status = 'low'
      lowStockCount++
    } else {
      status = 'in_stock'
    }

    return {
      productId: p.id,
      name: p.name,
      category: p.category?.name || 'Uncategorized',
      unit: p.unit.symbol,
      currentStock: p.currentStock,
      minStockLevel: p.minStockLevel,
      purchasePrice: p.purchasePrice || 0,
      salePrice: p.salePrice,
      stockValueAtPurchase: purchaseVal,
      stockValueAtSale: saleVal,
      stockStatus: status,
    }
  }).filter(item => !stockStatus || stockStatus === item.stockStatus)
    .slice(0, limit)

  return {
    data: {
      summary: {
        totalProducts: stats._count,
        totalStockValueAtPurchase,
        totalStockValueAtSale,
        lowStockCount,
        outOfStockCount,
      },
      items,
    },
    meta: { cursor: null, hasMore: false, total: items.length },
  }
}
