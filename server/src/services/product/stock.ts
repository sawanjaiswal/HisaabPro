/**
 * Product stock movement queries — list, history (cursor), and bulk adjustment.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { adjustStock, scheduleAlertChecks } from '../stock.service.js'
import logger from '../../lib/logger.js'
import type {
  StockMovementQuery,
  StockHistoryQuery,
  BulkStockAdjustInput,
} from '../../schemas/product.schemas.js'
import { requireProduct } from './helpers.js'
import { stockMovementSelect } from './selects.js'

export async function listStockMovements(
  businessId: string,
  productId: string,
  filters: StockMovementQuery
) {
  await requireProduct(businessId, productId)

  const { page, limit, type, startDate, endDate } = filters
  const skip = (page - 1) * limit

  const where: Prisma.StockMovementWhereInput = { productId, businessId }

  if (type) where.type = type
  if (startDate || endDate) {
    where.movementDate = {}
    if (startDate) where.movementDate.gte = new Date(startDate)
    if (endDate) where.movementDate.lte = new Date(endDate)
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: stockMovementSelect,
    }),
    prisma.stockMovement.count({ where }),
  ])

  return {
    movements,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

/** Paginated stock movement history using cursor-based pagination. */
export async function listStockHistory(
  businessId: string,
  productId: string,
  query: StockHistoryQuery
) {
  await requireProduct(businessId, productId)

  const { cursor, limit } = query

  const movements = await prisma.stockMovement.findMany({
    where: { productId, businessId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // fetch one extra to determine if there's a next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: stockMovementSelect,
  })

  const hasMore = movements.length > limit
  const items = hasMore ? movements.slice(0, limit) : movements
  const nextCursor = hasMore ? items[items.length - 1].id : null

  return { movements: items, pagination: { nextCursor, hasMore } }
}

/** Adjust stock for multiple products atomically inside a single transaction. */
export async function bulkAdjustStock(
  businessId: string,
  userId: string,
  input: BulkStockAdjustInput
) {
  const productIds = input.adjustments.map((a) => a.productId)

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: { id: true, name: true },
  })
  const foundIds = new Set(products.map((p) => p.id))
  const missing = productIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
    const { notFoundError } = await import('../../lib/errors.js')
    throw notFoundError(`Products not found: ${missing.join(', ')}`)
  }

  const results = await prisma.$transaction(async (tx) => {
    const movements = []
    for (const adj of input.adjustments) {
      const quantity = adj.type === 'ADJUSTMENT_IN' ? adj.quantity : -adj.quantity
      const result = await adjustStock(tx, {
        productId: adj.productId,
        businessId,
        quantity,
        type: adj.type,
        reason: adj.reason,
        customReason: adj.customReason,
        notes: adj.note,
        referenceType: 'ADJUSTMENT',
        userId,
      })
      movements.push({
        productId: adj.productId,
        movement: result.movement,
        previousStock: result.previousStock,
        newStock: result.newStock,
      })
    }
    return movements
  })

  scheduleAlertChecks(businessId, productIds)
  logger.info('Bulk stock adjustment completed', { businessId, count: results.length })
  return { results, count: results.length }
}
