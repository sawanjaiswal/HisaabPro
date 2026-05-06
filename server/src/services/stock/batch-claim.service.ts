/**
 * FEFO Batch Claim Service — BAT-02 / BAT-03
 *
 * Atomically claims batch stock using First-Expired-First-Out ordering.
 * MUST be called inside an outer $transaction — never opens its own (F-06).
 *
 * BAT-03 additions:
 *   - Accepts optional `policy` and `businessId` for expiry filtering.
 *   - FEFO WHERE clause excludes expired batches when policy=HARD_BLOCK.
 *   - Post-claim re-check via evaluateBatchPolicy (TOCTOU defense).
 *   - Returns `warnings[]` so caller can propagate to 200 response body.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { istMidnightUtc } from '../../lib/date.js'
import {
  evaluateBatchPolicy,
  type ExpiryPolicy,
  type BatchForPolicy,
} from './expiry-policy.js'
import type { BatchClaim, BatchCandidateRow, BatchUpdateRow } from './batch-claim.types.js'
import { resolveBatchAlerts } from './batch-expiry-alerts.service.js'

export type { BatchClaim } from './batch-claim.types.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

// ---------------------------------------------------------------------------
// Extended candidate row (BAT-03: expiry fields for policy check)
// ---------------------------------------------------------------------------

interface BatchCandidateRowExtended extends BatchCandidateRow {
  batchNumber: string
  productId: string
  productName: string
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/**
 * 409 INSUFFICIENT_BATCH_STOCK — thrown when the total claimable across all
 * FEFO candidates is less than the requested quantity.
 */
function insufficientBatchStockError(productId: string, requested: number, claimed: number) {
  return new AppError(
    ErrorCode.INSUFFICIENT_BATCH_STOCK,
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

export interface ClaimBatchesResult {
  claims: BatchClaim[]
  warnings: string[]
}

/**
 * Claims `requestedQty` units from the earliest-expiry batches of a product.
 *
 * Algorithm (per §3.2 architecture):
 * 1. SELECT … FOR UPDATE SKIP LOCKED — FEFO order, only in-stock non-deleted.
 *    When policy=HARD_BLOCK, WHERE clause also excludes expired batches.
 * 2. Post-SELECT expiry policy re-check (TOCTOU defense: batch could expire
 *    between the candidates query and the UPDATE).
 * 3. Walk candidates, take min(remaining, batch.currentStock) from each.
 * 4. Atomic per-row UPDATE … WHERE currentStock >= $take RETURNING.
 * 5. Accumulate BatchClaim results. Throw if total < requested.
 *
 * Called within the document-create outer $transaction — no nested tx.
 */
export async function claimBatchesFEFO(
  tx: TxClient,
  productId: string,
  requestedQty: number,
  options?: {
    policy?: ExpiryPolicy
    productName?: string
  }
): Promise<ClaimBatchesResult> {
  if (requestedQty <= 0) return { claims: [], warnings: [] }

  const policy = options?.policy ?? 'WARN_ONLY'
  const productName = options?.productName ?? productId
  const today = istMidnightUtc()

  // Step 1: Lock candidates in FEFO order — skip rows locked by concurrent tx.
  // HARD_BLOCK: DB-level exclusion of expired rows (extra defense per §3.2).
  // WARN_ONLY: include expired rows; policy evaluator will surface warnings.
  const candidates = policy === 'HARD_BLOCK'
    ? await tx.$queryRaw<BatchCandidateRowExtended[]>`
        SELECT b.id,
               b."currentStock",
               b."expiryDate",
               b."costPrice",
               b."batchNumber",
               b."productId",
               p.name AS "productName"
        FROM "Batch" b
        JOIN "Product" p ON p.id = b."productId"
        WHERE b."productId" = ${productId}
          AND b."isDeleted"  = false
          AND b."currentStock" > 0
          AND (b."expiryDate" IS NULL OR b."expiryDate" > ${today})
        ORDER BY b."expiryDate" ASC NULLS LAST, b.id ASC
        FOR UPDATE SKIP LOCKED
      `
    : await tx.$queryRaw<BatchCandidateRowExtended[]>`
        SELECT b.id,
               b."currentStock",
               b."expiryDate",
               b."costPrice",
               b."batchNumber",
               b."productId",
               p.name AS "productName"
        FROM "Batch" b
        JOIN "Product" p ON p.id = b."productId"
        WHERE b."productId" = ${productId}
          AND b."isDeleted"  = false
          AND b."currentStock" > 0
        ORDER BY b."expiryDate" ASC NULLS LAST, b.id ASC
        FOR UPDATE SKIP LOCKED
      `

  // Step 2: Post-SELECT expiry re-check (TOCTOU defense).
  const batchesForPolicy: BatchForPolicy[] = candidates.map(c => ({
    id: c.id,
    batchNumber: c.batchNumber,
    expiryDate: c.expiryDate,
    productId: c.productId,
    productName: c.productName ?? productName,
    currentStock: Number(c.currentStock),
    costPriceAtClaim: c.costPrice != null ? BigInt(c.costPrice) : null,
  }))

  const { allowed, warnings } = evaluateBatchPolicy({
    batches: batchesForPolicy,
    policy,
    asOf: today,
  })

  // Build a set of allowed batchIds for fast lookup
  const allowedIds = new Set(allowed.map(a => a.batchId))

  const claims: BatchClaim[] = []
  let remaining = requestedQty

  // Step 3: Walk FEFO order (only allowed batches)
  for (const candidate of candidates) {
    if (remaining <= 0) break
    if (!allowedIds.has(candidate.id)) continue

    const available = Number(candidate.currentStock)
    const take = Math.min(remaining, available)

    // Step 4: Atomic per-row decrement with TOCTOU guard
    const updated = await tx.$queryRaw<BatchUpdateRow[]>`
      UPDATE "Batch"
      SET "currentStock" = "currentStock" - ${take}
      WHERE id = ${candidate.id}
        AND "currentStock" >= ${take}
      RETURNING id, "currentStock"
    `

    if (updated.length !== 1) {
      // Race lost — another tx claimed this row between our SELECT and UPDATE.
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

    // Inline auto-resolve: when this claim drains the batch to 0, immediately
    // resolve any open EXPIRY_NEAR / EXPIRY_PASSED alerts so they don't linger
    // until the next 06:00 IST cron run.
    const newStock = Number(updated[0].currentStock)
    if (newStock <= 0) {
      const resolved = await resolveBatchAlerts(tx, candidate.id)
      if (resolved > 0) {
        logger.info('FEFO batch sold-out: expiry alerts auto-resolved', {
          batchId: candidate.id,
          resolved,
        })
      }
    }

    logger.info('FEFO batch claim segment', {
      batchId: candidate.id,
      qtyTaken: take,
      remainingAfter: remaining,
      costPriceAtClaim: costPriceAtClaim?.toString() ?? null,
    })
  }

  // Step 5: Guard — did we satisfy the full request?
  const totalClaimed = requestedQty - remaining
  if (remaining > 0) {
    throw insufficientBatchStockError(productId, requestedQty, totalClaimed)
  }

  return { claims, warnings }
}
