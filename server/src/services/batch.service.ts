/**
 * Batch Service — Phase 4 (#99 Batch Tracking + #105 Expiry Alerts)
 * Manages product batches. Amounts in PAISE. Scoped to businessId.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, conflictError, validationError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import type { CreateBatchInput, UpdateBatchInput, ListBatchesQuery, ExpiringBatchesQuery } from '../schemas/batch.schemas.js'

// === Helpers ===

async function requireBatch(businessId: string, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, businessId, isDeleted: false },
  })
  if (!batch) throw notFoundError('Batch')
  return batch
}

async function requireProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
  })
  if (!product) throw notFoundError('Product')
  return product
}

// === CRUD ===

export async function createBatch(
  businessId: string,
  productId: string,
  data: CreateBatchInput
) {
  await requireProduct(businessId, productId)

  // Validate uniqueness: businessId + productId + batchNumber
  const existing = await prisma.batch.findFirst({
    where: { businessId, productId, batchNumber: data.batchNumber, isDeleted: false },
    select: { id: true },
  })
  if (existing) throw conflictError(`Batch number "${data.batchNumber}" already exists for this product`)

  logger.info('Creating batch', { businessId, productId, batchNumber: data.batchNumber })

  const batch = await prisma.batch.create({
    data: {
      businessId,
      productId,
      batchNumber: data.batchNumber,
      manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      costPrice: data.costPrice ?? null,
      salePrice: data.salePrice ?? null,
      currentStock: data.currentStock,
      notes: data.notes ?? null,
    },
    select: batchDetailSelect,
  })

  return batch
}

export async function listBatches(
  businessId: string,
  productId: string,
  query: ListBatchesQuery
) {
  await requireProduct(businessId, productId)

  const { cursor, limit, includeDeleted } = query

  const where = {
    businessId,
    productId,
    ...(includeDeleted ? {} : { isDeleted: false }),
  }

  const batches = await prisma.batch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: batchListSelect,
  })

  const hasMore = batches.length > limit
  if (hasMore) batches.pop()

  const total = await prisma.batch.count({ where })

  return {
    batches,
    total,
    pagination: { nextCursor: hasMore ? batches[batches.length - 1]?.id ?? null : null },
  }
}

export async function getBatch(businessId: string, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, businessId, isDeleted: false },
    select: batchDetailSelect,
  })
  if (!batch) throw notFoundError('Batch')
  return batch
}

export async function updateBatch(
  businessId: string,
  batchId: string,
  data: UpdateBatchInput
) {
  const batch = await requireBatch(businessId, batchId)

  // Validate batchNumber uniqueness if changing
  if (data.batchNumber && data.batchNumber !== batch.batchNumber) {
    const existing = await prisma.batch.findFirst({
      where: { businessId, productId: batch.productId, batchNumber: data.batchNumber, isDeleted: false, id: { not: batchId } },
      select: { id: true },
    })
    if (existing) throw conflictError(`Batch number "${data.batchNumber}" already exists for this product`)
  }

  logger.info('Updating batch', { businessId, batchId })

  return prisma.batch.update({
    where: { id: batchId },
    data: {
      ...(data.batchNumber !== undefined && { batchNumber: data.batchNumber }),
      ...(data.manufacturingDate !== undefined && {
        manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
      }),
      ...(data.expiryDate !== undefined && {
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      }),
      ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
      ...(data.salePrice !== undefined && { salePrice: data.salePrice }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    select: batchDetailSelect,
  })
}

export async function deleteBatch(businessId: string, batchId: string) {
  const batch = await requireBatch(businessId, batchId)

  // Cannot delete if stock remains
  if (batch.currentStock > 0) {
    throw validationError('Cannot delete batch with remaining stock. Transfer or adjust stock to zero first.', {
      currentStock: batch.currentStock,
    })
  }

  logger.info('Soft-deleting batch', { businessId, batchId })

  await prisma.batch.update({
    where: { id: batchId },
    data: { isDeleted: true },
  })

  return { deleted: true, mode: 'soft' }
}

export async function getExpiringBatches(businessId: string, query: ExpiringBatchesQuery) {
  const { daysAhead, cursor, limit } = query
  const expiryThreshold = new Date()
  expiryThreshold.setDate(expiryThreshold.getDate() + daysAhead)

  const where = {
    businessId,
    isDeleted: false,
    currentStock: { gt: 0 },
    expiryDate: { lte: expiryThreshold, not: null },
  }

  const batches = await prisma.batch.findMany({
    where,
    orderBy: { expiryDate: 'asc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      ...batchListSelect,
      product: { select: { id: true, name: true, sku: true, unit: { select: { name: true, symbol: true } } } },
    },
  })

  const hasMore = batches.length > limit
  if (hasMore) batches.pop()

  const total = await prisma.batch.count({ where })

  return {
    batches,
    total,
    daysAhead,
    pagination: { nextCursor: hasMore ? batches[batches.length - 1]?.id ?? null : null },
  }
}

// === Select objects ===

const batchListSelect = {
  id: true,
  productId: true,
  batchNumber: true,
  manufacturingDate: true,
  expiryDate: true,
  costPrice: true,
  salePrice: true,
  currentStock: true,
  isDeleted: true,
  createdAt: true,
} as const

const batchDetailSelect = {
  id: true,
  businessId: true,
  productId: true,
  batchNumber: true,
  manufacturingDate: true,
  expiryDate: true,
  costPrice: true,
  salePrice: true,
  currentStock: true,
  notes: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const
