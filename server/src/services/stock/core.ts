/**
 * Stock Core — Atomic stock adjustment with SELECT FOR UPDATE locking.
 * Every stock change MUST go through adjustStock().
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { notFoundError, insufficientStockError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface AdjustStockParams {
  productId: string
  businessId: string
  quantity: number // positive = in, negative = out
  type: string
  reason?: string
  customReason?: string
  notes?: string
  referenceType?: string
  referenceId?: string
  referenceNumber?: string
  userId: string
  movementDate?: Date
  /** Pre-fetched business-level validation mode. Avoids extra DB hit when GLOBAL. */
  cachedBusinessValidationMode?: 'WARN_ONLY' | 'HARD_BLOCK'
}

/**
 * Resolve effective stock validation mode (product → business fallback).
 * Accepts an optional pre-fetched cachedMode to skip the DB call.
 */
async function resolveValidationMode(
  tx: TxClient,
  productMode: string,
  businessId: string,
  cachedMode?: 'WARN_ONLY' | 'HARD_BLOCK'
): Promise<'WARN_ONLY' | 'HARD_BLOCK'> {
  if (productMode !== 'GLOBAL') {
    return productMode as 'WARN_ONLY' | 'HARD_BLOCK'
  }

  if (cachedMode !== undefined) {
    return cachedMode
  }

  const setting = await tx.inventorySetting.findUnique({
    where: { businessId },
    select: { stockValidationMode: true },
  })

  return (setting?.stockValidationMode as 'WARN_ONLY' | 'HARD_BLOCK') ?? 'WARN_ONLY'
}

/**
 * Core atomic stock adjustment. MUST be called within a $transaction.
 * Uses raw SQL SELECT FOR UPDATE to lock the product row.
 */
export async function adjustStock(
  tx: TxClient,
  params: AdjustStockParams
) {
  // Step 1: Lock the product row
  const products = await tx.$queryRaw<
    Array<{ id: string; name: string; current_stock: number; min_stock_level: number; stock_validation: string; business_id: string }>
  >`SELECT id, name, "currentStock" as current_stock, "minStockLevel" as min_stock_level, "stockValidation" as stock_validation, "businessId" as business_id
     FROM "Product"
     WHERE id = ${params.productId} AND "businessId" = ${params.businessId}
     FOR UPDATE`

  if (!products[0]) throw notFoundError('Product')

  const currentStock = Number(products[0].current_stock)
  const newStock = currentStock + params.quantity

  // Step 2: Validate stock if reducing
  if (params.quantity < 0) {
    const validationMode = await resolveValidationMode(
      tx,
      products[0].stock_validation,
      params.businessId,
      params.cachedBusinessValidationMode
    )

    if (validationMode === 'HARD_BLOCK' && newStock < 0) {
      throw insufficientStockError(
        products[0].name,
        currentStock,
        Math.abs(params.quantity),
        Math.abs(newStock)
      )
    }
  }

  // Step 3: Update product stock
  await tx.product.update({
    where: { id: params.productId },
    data: { currentStock: newStock },
  })

  // Step 4: Create immutable movement record
  const movement = await tx.stockMovement.create({
    data: {
      businessId: params.businessId,
      productId: params.productId,
      type: params.type,
      quantity: params.quantity,
      balanceAfter: newStock,
      reason: params.reason ?? null,
      customReason: params.customReason ?? null,
      notes: params.notes ?? null,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      referenceNumber: params.referenceNumber ?? null,
      movementDate: params.movementDate ?? new Date(),
      createdBy: params.userId,
    },
    select: {
      id: true,
      productId: true,
      type: true,
      quantity: true,
      balanceAfter: true,
      reason: true,
      customReason: true,
      notes: true,
      referenceType: true,
      referenceId: true,
      referenceNumber: true,
      movementDate: true,
      createdBy: true,
      createdAt: true,
    },
  })

  logger.info('Stock adjusted', {
    productId: params.productId,
    type: params.type,
    quantity: params.quantity,
    newStock,
  })

  return { movement, previousStock: currentStock, newStock }
}
