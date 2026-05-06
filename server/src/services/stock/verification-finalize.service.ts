/**
 * Stock Verification Finalize — atomically applies all discrepancy adjustments
 * and marks the verification FINALIZED in a single $transaction.
 *
 * HARD_BLOCK does NOT apply here — this IS the truthing event.
 * We override validation mode to WARN_ONLY for every adjustment.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { adjustStock } from './core.js'
import { scheduleAlertChecks } from '../stock/invoice-ops.js'
import logger from '../../lib/logger.js'

export interface FinalizeResult {
  verificationId: string
  adjusted: number
  finalizedAt: Date
}

/**
 * Finalize a stock verification.
 * - If already FINALIZED, returns idempotent result with adjusted=0.
 * - Otherwise, inside one $transaction:
 *   1. Locks + loads verification and discrepant items.
 *   2. Calls adjustStock (row-locked) per discrepant item, bypassing HARD_BLOCK.
 *   3. Marks verification FINALIZED with finalizedAt + finalizedBy.
 * - After commit fires scheduleAlertChecks for all touched products.
 */
export async function finalizeVerification(
  verificationId: string,
  businessId: string,
  actorUserId: string
): Promise<FinalizeResult> {
  // Idempotency check — load outside tx for fast path
  const existing = await prisma.stockVerification.findFirst({
    where: { id: verificationId, businessId },
    select: { id: true, status: true, finalizedAt: true },
  })

  if (!existing) throw notFoundError('Stock verification')

  if (existing.status === 'FINALIZED') {
    logger.info('finalizeVerification: already finalized (idempotent)', { verificationId })
    return {
      verificationId,
      adjusted: 0,
      finalizedAt: existing.finalizedAt!,
    }
  }

  // Collect product IDs for post-commit alert evaluation
  const touchedProductIds: string[] = []

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    // Lock the verification row + load items with discrepancy in one query
    const [locked] = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status
      FROM "StockVerification"
      WHERE id = ${verificationId} AND "businessId" = ${businessId}
      FOR UPDATE`

    if (!locked) throw notFoundError('Stock verification')

    // If another concurrent tx already finalized, bail cleanly
    if (locked.status === 'FINALIZED') return

    const items = await tx.stockVerificationItem.findMany({
      where: {
        verificationId,
        discrepancy: { not: 0 },
        actualQuantity: { not: null },
      },
      select: { id: true, productId: true, discrepancy: true },
    })

    for (const item of items) {
      const delta = Number(item.discrepancy ?? 0)
      if (delta === 0) continue

      const type = delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'

      await adjustStock(tx, {
        productId: item.productId,
        businessId,
        quantity: delta,
        type,
        reason: 'AUDIT',
        notes: `Stock verification ${verificationId}`,
        referenceType: 'STOCK_VERIFICATION',
        referenceId: verificationId,
        userId: actorUserId,
        // Override: HARD_BLOCK must NOT fire during verification — this IS the truth
        cachedBusinessValidationMode: 'WARN_ONLY',
      })

      touchedProductIds.push(item.productId)
    }

    // Mark all adjusted items
    if (touchedProductIds.length > 0) {
      await tx.stockVerificationItem.updateMany({
        where: { verificationId, productId: { in: touchedProductIds } },
        data: { adjusted: true },
      })
    }

    // Flip status to FINALIZED atomically with the movements
    await tx.stockVerification.update({
      where: { id: verificationId },
      data: {
        status: 'FINALIZED',
        finalizedAt: now,
        finalizedBy: actorUserId,
        updatedAt: now,
      },
    })
  })

  logger.info('Stock verification finalized', {
    verificationId,
    businessId,
    actorUserId,
    adjustedItems: touchedProductIds.length,
  })

  // Post-commit: evaluate alerts (failures are logged, never block the response)
  if (touchedProductIds.length > 0) {
    scheduleAlertChecks(businessId, touchedProductIds)
  }

  return {
    verificationId,
    adjusted: touchedProductIds.length,
    finalizedAt: now,
  }
}
