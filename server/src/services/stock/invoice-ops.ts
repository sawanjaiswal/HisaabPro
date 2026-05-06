/**
 * Stock Invoice Operations — deduct/add/reverse stock for invoices,
 * plus the post-transaction alert scheduler.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { adjustStock } from './core.js'
import { checkAndCreateAlerts } from '../stock-alert.service.js'
import { stockShortageError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface InvoiceStockItem {
  productId: string
  quantity: number // in base units (already converted)
  /** When omitted, the quantity is assumed to be in the product's base unit */
  unitId?: string
}

/** Deduct stock for sale invoice items. Call within a transaction.
 *
 * Collects ALL shortfalls across every line item before throwing, so the
 * caller receives a single 409 STOCK_SHORTAGE with the full `items[]` array
 * rather than stopping at the first insufficient product.
 *
 * TOCTOU-safe: each product row is locked via SELECT…FOR UPDATE inside
 * adjustStock before the availability check and update occur.
 */
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
  // Fetch business-level validation mode once — avoids N DB hits when products use GLOBAL mode
  const invSetting = await tx.inventorySetting.findUnique({
    where: { businessId: params.businessId },
    select: { stockValidationMode: true },
  })
  const cachedBusinessValidationMode =
    (invSetting?.stockValidationMode as 'WARN_ONLY' | 'HARD_BLOCK') ?? 'WARN_ONLY'

  // Phase 1 (HARD_BLOCK only): pre-flight — collect ALL insufficient items.
  // We lock each row, compute availability, and accumulate shortfalls.
  // If any shortfall exists we throw ONE error with the full list before
  // writing any stock changes.
  if (cachedBusinessValidationMode === 'HARD_BLOCK') {
    type Row = { id: string; name: string; current_stock: number; stock_validation: string }
    const shortfalls: Array<{ productId: string; productName: string; requested: number; available: number }> = []

    for (const item of params.items) {
      const rows = await tx.$queryRaw<Row[]>`
        SELECT id, name, "currentStock" as current_stock, "stockValidation" as stock_validation
        FROM "Product"
        WHERE id = ${item.productId} AND "businessId" = ${params.businessId}
        FOR UPDATE`

      if (!rows[0]) continue // caught later by adjustStock

      const available = Number(rows[0].current_stock)
      const effectiveMode =
        rows[0].stock_validation !== 'GLOBAL'
          ? rows[0].stock_validation
          : cachedBusinessValidationMode

      if (effectiveMode === 'HARD_BLOCK' && available < item.quantity) {
        shortfalls.push({
          productId: item.productId,
          productName: rows[0].name,
          requested: item.quantity,
          available,
        })
      }
    }

    if (shortfalls.length > 0) {
      throw stockShortageError(shortfalls)
    }
  }

  // Phase 2: apply adjustments (rows already locked above for HARD_BLOCK;
  // for WARN_ONLY adjustStock will lock them individually).
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
      cachedBusinessValidationMode,
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
  // Fetch business-level validation mode once — avoids N DB hits when products use GLOBAL mode
  const invSetting = await tx.inventorySetting.findUnique({
    where: { businessId: params.businessId },
    select: { stockValidationMode: true },
  })
  const cachedBusinessValidationMode =
    (invSetting?.stockValidationMode as 'WARN_ONLY' | 'HARD_BLOCK') ?? 'WARN_ONLY'

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
      cachedBusinessValidationMode,
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

/**
 * Fire stock alert checks for a list of products.
 * Call AFTER a $transaction commits — never inside one.
 * Failures are caught and logged; never blocks the caller.
 */
export function scheduleAlertChecks(businessId: string, productIds: string[]): void {
  const unique = [...new Set(productIds)]
  for (const productId of unique) {
    checkAndCreateAlerts(businessId, productId).catch((err) => {
      logger.error('Stock alert check failed', { productId, error: (err as Error).message })
    })
  }
}
