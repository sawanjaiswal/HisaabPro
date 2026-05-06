/**
 * FEFO Batch Claim Service — BAT-02
 *
 * Atomically claims batch stock using First-Expired-First-Out ordering.
 * MUST be called inside an outer $transaction — never opens its own (F-06).
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import type { BatchClaim, BatchCandidateRow, BatchUpdateRow } from './batch-claim.types.js'

export type { BatchClaim } from './batch-claim.types.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/**
 * 409 INSUFFICIENT_BATCH_STOCK — thrown when the total claimable across all
 * FEFO candidates is less than the requested quantity.
 */
function insufficientBatchStockError(productId: string, requested: number, claimed: number) {
  return new AppError(
    ErrorCode.STOCK_SHORTAGE,
    409,
    `Insufficient batch stock for product ${productId}: requested ${requested}, available ${claimed}`,
    {
      code: 'INSUFFICIENT_BATCH_STOCK',
      productId,
      requested,
      claimed,
    }
  )
}

// ---------------------------------------------------------------------------
// Core FEFO claim
// ---------------------------------------------------------------------------

/**
 * Claims `requestedQty` units from the earliest-expiry batches of a product.
 *
 * Algorithm (per §3.2 architecture):
 * 1. SELECT … FOR UPDATE SKIP LOCKED — FEFO order, only in-stock non-deleted.
 * 2. Walk candidates, take min(remaining, batch.currentStock) from each.
 * 3. Atomic per-row UPDATE … WHERE currentStock >= $take RETURNING — defends
 *    against TOCTOU: if 0 rows returned, the race was lost; skip to next.
 * 4. Accumulate BatchClaim results. Throw if total < requested.
 *
 * Called within the document-create outer $transaction — no nested tx.
 */
export async function claimBatchesFEFO(
  tx: TxClient,
  productId: string,
  requestedQty: number
): Promise<BatchClaim[]> {
  if (requestedQty <= 0) return []

  // Step 1: Lock candidates in FEFO order — skip rows locked by concurrent tx
  const candidates = await tx.$queryRaw<BatchCandidateRow[]>`
    SELECT id,
           "currentStock",
           "expiryDate",
           "costPrice"
    FROM "Batch"
    WHERE "productId" = ${productId}
      AND "isDeleted" = false
      AND "currentStock" > 0
    ORDER BY "expiryDate" ASC NULLS LAST, id ASC
    FOR UPDATE SKIP LOCKED
  `

  const claims: BatchClaim[] = []
  let remaining = requestedQty

  // Step 2: Walk FEFO order
  for (const candidate of candidates) {
    if (remaining <= 0) break

    const available = Number(candidate.currentStock)
    const take = Math.min(remaining, available)

    // Step 3: Atomic per-row decrement with TOCTOU guard
    const updated = await tx.$queryRaw<BatchUpdateRow[]>`
      UPDATE "Batch"
      SET "currentStock" = "currentStock" - ${take}
      WHERE id = ${candidate.id}
        AND "currentStock" >= ${take}
      RETURNING id, "currentStock"
    `

    if (updated.length !== 1) {
      // Race lost — another tx claimed this row between our SELECT and UPDATE.
      // Continue to next candidate.
      logger.warn('FEFO TOCTOU race on batch, skipping', {
        batchId: candidate.id,
        take,
        currentStock: available,
      })
      continue
    }

    const costPriceAtClaim =
      candidate.costPrice != null ? BigInt(candidate.costPrice) : null

    claims.push({
      batchId: candidate.id,
      expiryDate: candidate.expiryDate,
      qtyTaken: take,
      costPriceAtClaim,
    })

    remaining -= take

    logger.info('FEFO batch claim segment', {
      batchId: candidate.id,
      qtyTaken: take,
      remainingAfter: remaining,
      costPriceAtClaim: costPriceAtClaim?.toString() ?? null,
    })
  }

  // Step 4: Guard — did we satisfy the full request?
  const totalClaimed = requestedQty - remaining
  if (remaining > 0) {
    throw insufficientBatchStockError(productId, requestedQty, totalClaimed)
  }

  return claims
}
