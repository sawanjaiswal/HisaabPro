/**
 * Stock Invoice Operations — sale-time deduction with expiry policy (BAT-03).
 * Purchase/reversal/alert scheduling → invoice-ops-purchase.ts.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { adjustStock } from './core.js'
import { stockShortageError } from '../../lib/errors.js'
import type { ExpiryPolicy } from './expiry-policy.js'
import { claimClientBatch, claimFEFO } from './invoice-ops-batch.js'
import { istMidnightUtc } from '../../lib/date.js'

export { addForPurchaseInvoice, reverseForInvoice, scheduleAlertChecks } from './invoice-ops-purchase.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface InvoiceStockItem {
  productId: string
  quantity: number
  unitId?: string
  unitCostPaise?: number
  batchTracking?: boolean
  /** Client-supplied batchId (batch picker). BAT-03: ownership + expiry enforced. */
  batchId?: string
  productName?: string
}

export interface SaleInvoiceResult {
  movements: object[]
  warnings: string[]
}

/**
 * Deduct stock for sale invoice items (within a tx).
 * Returns { movements, warnings } — warnings[] are WARN_ONLY expiry notices.
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
): Promise<SaleInvoiceResult> {
  // Fetch business-level validation mode + expiry policy once
  const [invSetting, business] = await Promise.all([
    tx.inventorySetting.findUnique({
      where: { businessId: params.businessId },
      select: { stockValidationMode: true },
    }),
    tx.business.findUnique({
      where: { id: params.businessId },
      select: { expiredBatchPolicy: true },
    }),
  ])

  const cachedBusinessValidationMode =
    (invSetting?.stockValidationMode as 'WARN_ONLY' | 'HARD_BLOCK') ?? 'WARN_ONLY'
  const expiredBatchPolicy: ExpiryPolicy =
    (business?.expiredBatchPolicy as ExpiryPolicy) ?? 'WARN_ONLY'

  const today = istMidnightUtc()
  const allWarnings: string[] = []

  // Phase 1 (HARD_BLOCK): pre-flight — collect ALL insufficient non-batch items.
  if (cachedBusinessValidationMode === 'HARD_BLOCK') {
    type Row = { id: string; name: string; current_stock: number; stock_validation: string }
    const shortfalls: Array<{ productId: string; productName: string; requested: number; available: number }> = []

    for (const item of params.items) {
      if (item.batchTracking) continue // batch items handled separately

      const rows = await tx.$queryRaw<Row[]>`
        SELECT id, name, "currentStock" as current_stock, "stockValidation" as stock_validation
        FROM "Product"
        WHERE id = ${item.productId} AND "businessId" = ${params.businessId}
        FOR UPDATE`

      if (!rows[0]) continue

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

    if (shortfalls.length > 0) throw stockShortageError(shortfalls)
  }

  // Phase 2: apply adjustments
  const results: object[] = []

  for (const item of params.items) {
    if (item.batchTracking) {
      if (item.batchId) {
        await claimClientBatch(tx, item, params, expiredBatchPolicy, today, results, allWarnings)
      } else {
        await claimFEFO(tx, item, params, expiredBatchPolicy, results, allWarnings)
      }

      // Product-level stock rollup (batch + product stay in sync)
      const productResult = await adjustStock(tx, {
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

      if (productResult.warning) allWarnings.push(productResult.warning)

      // Back-fill balanceAfter on the batch movements (last N pushed)
      const productBalanceAfter = productResult.newStock
      for (const mov of results) {
        const m = mov as { id: string }
        await tx.stockMovement.update({
          where: { id: m.id },
          data: { balanceAfter: productBalanceAfter },
        })
      }
    } else {
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
      if (result.warning) allWarnings.push(result.warning)
    }
  }

  return { movements: results, warnings: allWarnings }
}
