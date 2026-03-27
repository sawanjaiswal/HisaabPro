/**
 * Stock Verification Service — Feature #111
 * Snapshot system stock → count physically → detect discrepancies → apply adjustments.
 * All writes are in $transaction. Adjustments use the core adjustStock() to keep audit trail.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import { adjustStock } from './stock.service.js'
import logger from '../lib/logger.js'
import type {
  CreateVerificationInput,
  UpdateVerificationItemInput,
  ListVerificationsQuery,
  CompleteVerificationInput,
} from '../schemas/stock-verification.schemas.js'

// === Helpers ===

async function requireVerification(businessId: string, verificationId: string) {
  const v = await prisma.stockVerification.findFirst({
    where: { id: verificationId, businessId },
    select: { id: true, status: true },
  })
  if (!v) throw notFoundError('Stock verification')
  return v
}

// === Service functions ===

/**
 * Create a new verification in DRAFT status.
 * Snapshots systemQuantity (currentStock) for ALL active products.
 */
export async function createVerification(
  businessId: string,
  userId: string,
  data: CreateVerificationInput
) {
  logger.info('Creating stock verification', { businessId, userId })

  // Fetch all active products in one query
  const products = await prisma.product.findMany({
    where: { businessId, status: 'ACTIVE' },
    select: { id: true, currentStock: true },
    orderBy: { name: 'asc' },
    take: 2000, // verification needs all products; bounded by practical catalog size
  })

  return prisma.$transaction(async (tx) => {
    const verification = await tx.stockVerification.create({
      data: {
        businessId,
        verifiedBy: userId,
        status: 'IN_PROGRESS',
        notes: data.notes ?? null,
        updatedAt: new Date(),
      },
      select: {
        id: true, businessId: true, verifiedBy: true,
        status: true, notes: true, createdAt: true, updatedAt: true,
      },
    })

    if (products.length > 0) {
      await tx.stockVerificationItem.createMany({
        data: products.map((p) => ({
          verificationId: verification.id,
          productId: p.id,
          systemQuantity: Number(p.currentStock),
        })),
      })
    }

    return { verification, itemCount: products.length }
  })
}

/** Record the physical count for one item. */
export async function updateItemCount(
  businessId: string,
  verificationId: string,
  itemId: string,
  data: UpdateVerificationItemInput
) {
  const v = await requireVerification(businessId, verificationId)
  if (v.status === 'COMPLETED') {
    throw validationError('Cannot update items in a completed verification')
  }

  const item = await prisma.stockVerificationItem.findFirst({
    where: { id: itemId, verificationId },
    select: { id: true, systemQuantity: true },
  })
  if (!item) throw notFoundError('Verification item')

  const discrepancy = data.actualQuantity - item.systemQuantity

  return prisma.stockVerificationItem.update({
    where: { id: itemId },
    data: {
      actualQuantity: data.actualQuantity,
      discrepancy,
      notes: data.notes ?? null,
    },
    select: {
      id: true, productId: true, systemQuantity: true,
      actualQuantity: true, discrepancy: true, adjusted: true, notes: true,
    },
  })
}

/** Mark verification COMPLETED. Calculates discrepancies for all counted items. */
export async function completeVerification(
  businessId: string,
  verificationId: string,
  data: CompleteVerificationInput
) {
  const v = await requireVerification(businessId, verificationId)
  if (v.status === 'COMPLETED') {
    throw validationError('Verification is already completed')
  }

  return prisma.stockVerification.update({
    where: { id: verificationId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      ...(data.notes !== undefined && { notes: data.notes }),
      updatedAt: new Date(),
    },
    select: {
      id: true, status: true, completedAt: true, notes: true, updatedAt: true,
    },
  })
}

/**
 * Apply adjustments for all discrepancies where actualQuantity was recorded.
 * Creates StockMovement records (type AUDIT) for each discrepancy != 0.
 * Idempotent — skips items already adjusted.
 */
export async function applyAdjustments(
  businessId: string,
  verificationId: string,
  userId: string
) {
  const v = await requireVerification(businessId, verificationId)
  if (v.status !== 'COMPLETED') {
    throw validationError('Verification must be completed before applying adjustments')
  }

  // Fetch items that have been counted, have a non-zero discrepancy, and not yet adjusted
  const items = await prisma.stockVerificationItem.findMany({
    where: {
      verificationId,
      actualQuantity: { not: null },
      discrepancy: { not: 0 },
      adjusted: false,
    },
    select: {
      id: true,
      productId: true,
      discrepancy: true,
    },
    take: 2000, // bounded by product catalog size (matches products query limit above)
  })

  if (items.length === 0) {
    return { adjustedCount: 0 }
  }

  let adjustedCount = 0

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const delta = Number(item.discrepancy ?? 0)
      await adjustStock(tx, {
        productId: item.productId,
        businessId,
        quantity: delta, // positive = surplus in, negative = deficit out
        type: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        reason: 'AUDIT',
        notes: `Stock verification ${verificationId}`,
        referenceType: 'ADJUSTMENT',
        referenceId: verificationId,
        userId,
      })

      await tx.stockVerificationItem.update({
        where: { id: item.id },
        data: { adjusted: true },
      })

      adjustedCount++
    }
  })

  logger.info('Stock verification adjustments applied', {
    businessId, verificationId, adjustedCount,
  })

  return { adjustedCount }
}

/** Paginated list of verifications (cursor-based). */
export async function listVerifications(
  businessId: string,
  query: ListVerificationsQuery
) {
  const { cursor, limit, status } = query

  const where = {
    businessId,
    ...(status && { status }),
    ...(cursor && { createdAt: { lt: new Date(cursor) } }),
  }

  const verifications = await prisma.stockVerification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      status: true,
      notes: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  })

  const hasMore = verifications.length > limit
  const data = hasMore ? verifications.slice(0, limit) : verifications
  const nextCursor = hasMore ? data[data.length - 1].createdAt.toISOString() : null

  return {
    verifications: data.map((v) => ({ ...v, itemCount: v._count.items, _count: undefined })),
    nextCursor,
    hasMore,
  }
}

/** Get one verification with all its items. */
export async function getVerification(businessId: string, verificationId: string) {
  const verification = await prisma.stockVerification.findFirst({
    where: { id: verificationId, businessId },
    select: {
      id: true,
      status: true,
      notes: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          systemQuantity: true,
          actualQuantity: true,
          discrepancy: true,
          adjusted: true,
          notes: true,
          product: {
            select: {
              id: true, name: true, sku: true,
              unit: { select: { symbol: true } },
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
      },
    },
  })

  if (!verification) throw notFoundError('Stock verification')
  return verification
}
