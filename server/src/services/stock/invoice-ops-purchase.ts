/**
 * Stock Invoice Operations — purchase, reversal, alert scheduling.
 *
 * Split from invoice-ops.ts (≤250 LOC constraint).
 * Sale path lives in invoice-ops.ts.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { adjustStock } from './core.js'
import { checkAndCreateAlerts } from '../stock-alert.service.js'
import logger from '../../lib/logger.js'
import type { InvoiceStockItem } from './invoice-ops.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

/** Weighted-avg cost (paise) with banker's rounding. Returns unitCost when prevQty <= 0. */
export function computeWeightedAvg(
  prevQty: number,
  prevAvgPaise: bigint,
  inQty: number,
  unitCostPaise: number
): bigint {
  if (prevQty <= 0) return BigInt(unitCostPaise)
  const raw = (prevQty * Number(prevAvgPaise) + inQty * unitCostPaise) / (prevQty + inQty)
  const floor = Math.floor(raw)
  const frac = raw - floor
  const rounded = frac < 0.5 ? floor : frac > 0.5 ? floor + 1 : floor % 2 === 0 ? floor : floor + 1
  return BigInt(rounded)
}

/** Add stock for received goods (purchase invoice, customer return). Call
 * within a transaction. Updates weightedAvgCostPaise per item when the movement
 * is an actual purchase and unitCostPaise > 0.
 */
export async function addForPurchaseInvoice(
  tx: TxClient,
  params: {
    businessId: string
    invoiceId: string
    invoiceNumber: string
    items: InvoiceStockItem[]
    userId: string
    /** Movement labels — see document/helpers.ts stockMovementLabels(). */
    movementType?: string
    movementReferenceType?: string
  }
) {
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
      type: params.movementType ?? 'PURCHASE',
      referenceType: params.movementReferenceType ?? 'PURCHASE_INVOICE',
      referenceId: params.invoiceId,
      referenceNumber: params.invoiceNumber,
      userId: params.userId,
      cachedBusinessValidationMode,
    })

    // Only a real purchase moves the cost basis. A customer return comes back
    // in through this same helper carrying the SALE price on its line, and
    // averaging that in would reprice the shelf at what the goods sold for —
    // every margin after it computed against a cost the shop never paid.
    const isPurchase = (params.movementReferenceType ?? 'PURCHASE_INVOICE') === 'PURCHASE_INVOICE'
    if (isPurchase && item.unitCostPaise !== undefined && item.unitCostPaise > 0) {
      const prevQty = result.previousStock
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { weightedAvgCostPaise: true },
      })
      const prevAvg = product?.weightedAvgCostPaise ?? BigInt(0)
      const newAvg = computeWeightedAvg(prevQty, prevAvg, item.quantity, item.unitCostPaise)

      await tx.product.update({
        where: { id: item.productId },
        data: { weightedAvgCostPaise: newAvg },
      })

      logger.info('Weighted-avg cost updated', {
        productId: item.productId,
        prevQty,
        prevAvg: Number(prevAvg),
        newAvg: Number(newAvg),
        inQty: item.quantity,
        unitCostPaise: item.unitCostPaise,
      })
    }

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
      quantity: -mov.quantity,
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
 */
export function scheduleAlertChecks(businessId: string, productIds: string[]): void {
  const unique = [...new Set(productIds)]
  for (const productId of unique) {
    checkAndCreateAlerts(businessId, productId).catch((err) => {
      logger.error('Stock alert check failed', { productId, error: (err as Error).message })
    })
  }
}
