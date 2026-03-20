/**
 * Godown Transfer Service — Phase 4 (#101 Multi-Godown)
 * Stock transfer between godowns. Scoped to businessId.
 * All multi-table writes use prisma.$transaction.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import type { TransferStockInput, TransferHistoryQuery } from '../schemas/godown.schemas.js'

export async function transferStock(
  businessId: string,
  userId: string,
  data: TransferStockInput
) {
  const { productId, fromGodownId, toGodownId, quantity, batchId, notes } = data

  if (fromGodownId === toGodownId) {
    throw validationError('Source and destination godown must be different')
  }

  // Validate godowns belong to this business
  const [fromGodown, toGodown] = await Promise.all([
    prisma.godown.findFirst({
      where: { id: fromGodownId, businessId, isDeleted: false },
      select: { id: true, name: true },
    }),
    prisma.godown.findFirst({
      where: { id: toGodownId, businessId, isDeleted: false },
      select: { id: true, name: true },
    }),
  ])
  if (!fromGodown) throw notFoundError('Source godown')
  if (!toGodown) throw notFoundError('Destination godown')

  // Validate product belongs to this business
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true, name: true },
  })
  if (!product) throw notFoundError('Product')

  // Validate batch if provided
  if (batchId) {
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, businessId, productId, isDeleted: false },
      select: { id: true },
    })
    if (!batch) throw notFoundError('Batch')
  }

  logger.info('Transferring stock between godowns', {
    businessId, productId, fromGodownId, toGodownId, quantity, batchId,
  })

  return prisma.$transaction(async (tx) => {
    // Check source godown has enough stock
    const sourceStock = await tx.godownStock.findFirst({
      where: { businessId, productId, godownId: fromGodownId, batchId: batchId ?? null },
      select: { id: true, quantity: true },
    })

    if (!sourceStock || sourceStock.quantity < quantity) {
      const availableQty = sourceStock?.quantity ?? 0
      throw validationError(
        `Insufficient stock in source godown. Available: ${availableQty}, requested: ${quantity}`,
        { available: availableQty, requested: quantity }
      )
    }

    // Decrement source stock
    await tx.godownStock.update({
      where: { id: sourceStock.id },
      data: { quantity: { decrement: quantity } },
    })

    // Upsert destination stock (find-or-create for nullable batchId)
    const destStock = await tx.godownStock.findFirst({
      where: { businessId, productId, godownId: toGodownId, batchId: batchId ?? null },
      select: { id: true },
    })
    if (destStock) {
      await tx.godownStock.update({
        where: { id: destStock.id },
        data: { quantity: { increment: quantity } },
      })
    } else {
      await tx.godownStock.create({
        data: {
          businessId,
          productId,
          godownId: toGodownId,
          batchId: batchId ?? null,
          quantity,
        },
      })
    }

    // Record the transfer
    return tx.godownTransfer.create({
      data: {
        businessId,
        productId,
        batchId: batchId ?? null,
        fromGodownId,
        toGodownId,
        quantity,
        notes: notes ?? null,
        transferredBy: userId,
      },
      select: transferDetailSelect,
    })
  })
}

export async function listTransferHistory(
  businessId: string,
  query: TransferHistoryQuery
) {
  const { productId, godownId, cursor, limit, startDate, endDate } = query

  const where = {
    businessId,
    ...(productId ? { productId } : {}),
    ...(godownId ? { OR: [{ fromGodownId: godownId }, { toGodownId: godownId }] } : {}),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        }
      : {}),
  }

  const transfers = await prisma.godownTransfer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: transferDetailSelect,
  })

  const hasMore = transfers.length > limit
  if (hasMore) transfers.pop()

  const total = await prisma.godownTransfer.count({ where })

  return {
    transfers,
    total,
    pagination: { nextCursor: hasMore ? transfers[transfers.length - 1]?.id ?? null : null },
  }
}

// === Select objects ===

const transferDetailSelect = {
  id: true,
  businessId: true,
  productId: true,
  batchId: true,
  fromGodownId: true,
  toGodownId: true,
  quantity: true,
  notes: true,
  transferredBy: true,
  createdAt: true,
  product: { select: { id: true, name: true, sku: true } },
  fromGodown: { select: { id: true, name: true } },
  toGodown: { select: { id: true, name: true } },
  batch: { select: { id: true, batchNumber: true } },
  user: { select: { id: true, name: true } },
} as const
