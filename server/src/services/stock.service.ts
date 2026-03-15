/**
 * Stock Service — Atomic stock operations
 * Every stock change MUST go through this service.
 * Uses SELECT FOR UPDATE to prevent race conditions.
 * Reused by Product routes (manual adjust) and Invoice module (auto deduct/add).
 */

import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { notFoundError, insufficientStockError } from '../lib/errors.js'
import logger from '../lib/logger.js'

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

interface AdjustStockParams {
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
  const products = await tx.$queryRawUnsafe<
    Array<{ id: string; name: string; current_stock: number; min_stock_level: number; stock_validation: string; business_id: string }>
  >(
    `SELECT id, name, "currentStock" as current_stock, "minStockLevel" as min_stock_level, "stockValidation" as stock_validation, "businessId" as business_id
     FROM "Product"
     WHERE id = $1 AND "businessId" = $2
     FOR UPDATE`,
    params.productId,
    params.businessId
  )

  if (!products[0]) throw notFoundError('Product')

  const currentStock = Number(products[0].current_stock)
  const newStock = currentStock + params.quantity

  // Step 2: Validate stock if reducing
  if (params.quantity < 0) {
    const validationMode = await resolveValidationMode(
      tx,
      products[0].stock_validation,
      params.businessId
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

/** Resolve effective stock validation mode (product → business fallback) */
async function resolveValidationMode(
  tx: TxClient,
  productMode: string,
  businessId: string
): Promise<'WARN_ONLY' | 'HARD_BLOCK'> {
  if (productMode !== 'GLOBAL') {
    return productMode as 'WARN_ONLY' | 'HARD_BLOCK'
  }

  const setting = await tx.inventorySetting.findUnique({
    where: { businessId },
    select: { stockValidationMode: true },
  })

  return (setting?.stockValidationMode as 'WARN_ONLY' | 'HARD_BLOCK') ?? 'WARN_ONLY'
}

// === Service-layer functions for Invoicing module ===

interface InvoiceStockItem {
  productId: string
  quantity: number // in base units (already converted)
  unitId: string
}

/** Deduct stock for sale invoice items. Call within a transaction. */
export async function deductForSaleInvoice(
  tx: TxClient,
  params: {
    businessId: string
    invoiceId: string
    invoiceNumber: string
    items: InvoiceStockItem[]
    userId: string
  }
) {
  const results = []
  for (const item of params.items) {
    const result = await adjustStock(tx, {
      productId: item.productId,
      businessId: params.businessId,
      quantity: -item.quantity,
      type: 'SALE',
      referenceType: 'SALE_INVOICE',
      referenceId: params.invoiceId,
      referenceNumber: params.invoiceNumber,
      userId: params.userId,
    })
    results.push(result.movement)
  }
  return results
}

/** Add stock for purchase invoice items. Call within a transaction. */
export async function addForPurchaseInvoice(
  tx: TxClient,
  params: {
    businessId: string
    invoiceId: string
    invoiceNumber: string
    items: InvoiceStockItem[]
    userId: string
  }
) {
  const results = []
  for (const item of params.items) {
    const result = await adjustStock(tx, {
      productId: item.productId,
      businessId: params.businessId,
      quantity: item.quantity,
      type: 'PURCHASE',
      referenceType: 'PURCHASE_INVOICE',
      referenceId: params.invoiceId,
      referenceNumber: params.invoiceNumber,
      userId: params.userId,
    })
    results.push(result.movement)
  }
  return results
}

/** Reverse all stock movements for an invoice. Call within a transaction. */
export async function reverseForInvoice(
  tx: TxClient,
  params: {
    businessId: string
    invoiceId: string
    userId: string
  }
) {
  // Find all movements for this invoice
  const movements = await tx.stockMovement.findMany({
    where: {
      businessId: params.businessId,
      referenceId: params.invoiceId,
    },
    select: {
      productId: true,
      quantity: true,
    },
  })

  const results = []
  for (const mov of movements) {
    const result = await adjustStock(tx, {
      productId: mov.productId,
      businessId: params.businessId,
      quantity: -mov.quantity, // reverse the original
      type: 'REVERSAL',
      referenceType: 'ADJUSTMENT',
      referenceId: params.invoiceId,
      userId: params.userId,
    })
    results.push(result.movement)
  }
  return results
}

/** Validate stock availability before invoice save */
export async function validateStockForInvoice(
  businessId: string,
  items: InvoiceStockItem[]
) {
  const results = []
  let allValid = true

  for (const item of items) {
    const product = await prisma.product.findFirst({
      where: { id: item.productId, businessId },
      select: {
        id: true,
        name: true,
        currentStock: true,
        stockValidation: true,
        unit: { select: { name: true, symbol: true } },
      },
    })

    if (!product) {
      results.push({
        productId: item.productId,
        productName: 'Unknown',
        requestedQty: item.quantity,
        requestedUnit: '',
        currentStock: 0,
        deficit: item.quantity,
        validation: 'BLOCK' as const,
        message: 'Product not found',
      })
      allValid = false
      continue
    }

    // Convert quantity if unit differs from product's base unit
    let baseQty = item.quantity
    if (item.unitId !== product.id) {
      const conversion = await prisma.unitConversion.findFirst({
        where: {
          businessId,
          fromUnitId: item.unitId,
          toUnitId: product.id,
        },
        select: { factor: true },
      })
      if (conversion) {
        baseQty = item.quantity * conversion.factor
      }
    }

    const deficit = baseQty - product.currentStock
    if (deficit <= 0) {
      results.push({
        productId: product.id,
        productName: product.name,
        requestedQty: baseQty,
        requestedUnit: product.unit.symbol,
        currentStock: product.currentStock,
        deficit: 0,
        validation: 'OK' as const,
        message: null,
      })
      continue
    }

    // Resolve validation mode
    const setting = await prisma.inventorySetting.findUnique({
      where: { businessId },
      select: { stockValidationMode: true },
    })
    const businessMode = setting?.stockValidationMode ?? 'WARN_ONLY'
    const effectiveMode = product.stockValidation === 'GLOBAL'
      ? businessMode
      : product.stockValidation

    const validation = effectiveMode === 'HARD_BLOCK' ? 'BLOCK' : 'WARN'
    if (validation === 'BLOCK') allValid = false

    results.push({
      productId: product.id,
      productName: product.name,
      requestedQty: baseQty,
      requestedUnit: product.unit.symbol,
      currentStock: product.currentStock,
      deficit,
      validation,
      message: `Only ${product.currentStock} ${product.unit.symbol} available, ${baseQty} requested`,
    })
  }

  return { valid: allValid, items: results }
}
