/**
 * Business-wide stock adjustment log (mockup #48).
 *
 * `listStockMovements` answers "what happened to THIS product". This answers
 * "what did we adjust today", across every product — the manual corrections
 * only, never the movements a sale or purchase wrote by itself.
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import type { StockAdjustmentQuery } from '../../schemas/product/stock.schemas.js'

const ADJUSTMENT_TYPES = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] as const

const adjustmentSelect = {
  id: true,
  type: true,
  quantity: true,
  balanceAfter: true,
  reason: true,
  customReason: true,
  notes: true,
  movementDate: true,
  product: {
    select: {
      id: true,
      name: true,
      unit: { select: { symbol: true } },
    },
  },
} satisfies Prisma.StockMovementSelect

export async function listStockAdjustments(
  businessId: string,
  query: StockAdjustmentQuery
) {
  const { cursor, limit, search, direction } = query

  const where: Prisma.StockMovementWhereInput = {
    businessId,
    type: direction ? direction : { in: [...ADJUSTMENT_TYPES] },
  }

  // Product name is the only thing on the row a user could be searching for.
  if (search) {
    where.product = { name: { contains: search, mode: 'insensitive' } }
  }

  const rows = await prisma.stockMovement.findMany({
    where,
    orderBy: [{ movementDate: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: adjustmentSelect,
  })

  const hasMore = rows.length > limit
  const adjustments = hasMore ? rows.slice(0, limit) : rows

  return {
    adjustments,
    pagination: {
      nextCursor: hasMore ? (adjustments[adjustments.length - 1]?.id ?? null) : null,
    },
  }
}
