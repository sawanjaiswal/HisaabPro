/**
 * POS Checkout — Inventory Claim & Stock Movement
 *
 * Wraps the existing adjustStock (core.ts) and claimBatchesFEFO (batch-claim.service.ts).
 * FEFO is used when the product has batches; manual batch used when batchId is provided.
 * Oversell policy read from InventorySetting (business-level) unless product overrides.
 *
 * MUST be called within the outer Prisma $transaction.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { TaxedLine } from './pos.types.js'
import { adjustStock } from '../stock/core.js'
import { claimBatchesFEFO } from '../stock/batch-claim.service.js'
import { oversellBlockedError, expiredBatchBlockedError } from './pos.errors.js'
import {
  POS_STOCK_MOVEMENT_TYPE,
  POS_STOCK_REFERENCE_TYPE,
} from './pos.constants.js'
import logger from '../../lib/logger.js'
import { istMidnightUtc } from '../../lib/date.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface InventoryResult {
  warnings: string[]
  /** Map of productId → batchId actually claimed (for receipt/PosSaleItem) */
  batchClaims: Map<string, string>
}

/**
 * Claim stock for all POS sale lines within the current transaction.
 *
 * Steps per line:
 * 1. If batchId provided → validate batch exists, not expired (per policy), decrement.
 * 2. Else if product has batches → FEFO claim via claimBatchesFEFO.
 * 3. Else → plain adjustStock (no batch).
 *
 * @param tx          - Prisma tx client
 * @param businessId  - Owning business
 * @param userId      - Cashier user ID
 * @param lines       - Taxed + priced lines
 * @param posSaleId   - Will be set as referenceId on StockMovement (pass empty string pre-create;
 *                      caller updates afterward — or we accept a placeholder "pending")
 * @param receiptNumber - For movement notes
 */
export async function claimInventory(
  tx: TxClient,
  businessId: string,
  userId: string,
  lines: TaxedLine[],
  posSaleId: string,
  receiptNumber: string
): Promise<InventoryResult> {
  const warnings: string[] = []
  const batchClaims = new Map<string, string>()

  // Resolve business-level oversell and expiry policies in one shot
  const [inventorySetting, business] = await Promise.all([
    tx.inventorySetting.findUnique({
      where: { businessId },
      select: { stockValidationMode: true },
    }),
    tx.business.findUnique({
      where: { id: businessId },
      select: { expiredBatchPolicy: true },
    }),
  ])

  const expiryPolicy = (business?.expiredBatchPolicy ?? 'WARN_ONLY') as
    'WARN_ONLY' | 'HARD_BLOCK'
  const stockPolicy = (inventorySetting?.stockValidationMode ?? 'WARN_ONLY') as
    'WARN_ONLY' | 'HARD_BLOCK'

  for (const line of lines) {
    try {
      if (line.batchId) {
        // Manual batch specified by cashier
        await claimManualBatch(
          tx,
          businessId,
          userId,
          line,
          posSaleId,
          receiptNumber,
          expiryPolicy,
          batchClaims
        )
      } else {
        // Check if product has any batches → FEFO
        const batchCount = await tx.batch.count({
          where: { productId: line.productId, businessId, isDeleted: false, currentStock: { gt: 0 } },
        })

        if (batchCount > 0) {
          const result = await claimBatchesFEFO(tx, line.productId, line.quantity, {
            policy: expiryPolicy,
            productName: line.productName,
          })
          warnings.push(...result.warnings)
          if (result.claims.length > 0) {
            batchClaims.set(line.productId, result.claims[0]!.batchId)
          }
        } else {
          // Plain stock adjustment
          const adjusted = await adjustStock(tx, {
            productId: line.productId,
            businessId,
            quantity: -line.quantity,
            type: POS_STOCK_MOVEMENT_TYPE,
            referenceType: POS_STOCK_REFERENCE_TYPE,
            referenceId: posSaleId,
            referenceNumber: receiptNumber,
            userId,
            cachedBusinessValidationMode: stockPolicy,
          })
          // WARN_ONLY let the sale through — the cashier still has to be told.
          if (adjusted.warning) warnings.push(adjusted.warning)
        }
      }
    } catch (err: unknown) {
      // Re-throw adjustStock's HARD_BLOCK errors as POS-specific oversell errors
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'INSUFFICIENT_STOCK' &&
        stockPolicy === 'HARD_BLOCK'
      ) {
        throw oversellBlockedError(line.productId, line.productName, 0)
      }
      throw err
    }

    logger.debug(`POS inventory claimed productId=${line.productId} qty=${line.quantity}`)
  }

  return { warnings, batchClaims }
}

async function claimManualBatch(
  tx: TxClient,
  businessId: string,
  userId: string,
  line: TaxedLine,
  posSaleId: string,
  receiptNumber: string,
  expiryPolicy: 'WARN_ONLY' | 'HARD_BLOCK',
  batchClaims: Map<string, string>
): Promise<void> {
  const batch = await tx.batch.findFirst({
    where: { id: line.batchId!, businessId, productId: line.productId, isDeleted: false },
    select: { id: true, batchNumber: true, expiryDate: true, currentStock: true },
  })

  if (!batch) {
    throw oversellBlockedError(line.productId, line.productName, 0)
  }

  // Expiry check
  if (batch.expiryDate) {
    const today = istMidnightUtc()
    if (batch.expiryDate <= today) {
      if (expiryPolicy === 'HARD_BLOCK') {
        throw expiredBatchBlockedError(batch.id, batch.batchNumber, batch.expiryDate)
      }
      // WARN_ONLY — allow but surface warning
    }
  }

  // Decrement batch stock and product stock atomically, create movement with batchId.
  // We cannot use adjustStock() here because AdjustStockParams has no batchId field.
  await tx.batch.update({
    where: { id: batch.id },
    data: { currentStock: { decrement: line.quantity } },
  })
  await tx.product.update({
    where: { id: line.productId },
    data: { currentStock: { decrement: line.quantity } },
  })
  await tx.stockMovement.create({
    data: {
      businessId,
      productId: line.productId,
      type: POS_STOCK_MOVEMENT_TYPE,
      quantity: -line.quantity,
      balanceAfter: 0,  // TODO(PR-followup): compute exact balance via FOR UPDATE query
      referenceType: POS_STOCK_REFERENCE_TYPE,
      referenceId: posSaleId,
      referenceNumber: receiptNumber,
      createdBy: userId,
      batchId: batch.id,
    },
  })

  batchClaims.set(line.productId, batch.id)
}
