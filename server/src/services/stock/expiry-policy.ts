/**
 * Expiry Policy Enforcement — BAT-03
 *
 * Pure validator: no Prisma calls, no side effects.
 * Called from FEFO selection and per-line-item checks in invoice-ops.ts.
 *
 * Two policies (decoupled from stockValidationMode per §1.2 architecture):
 *   HARD_BLOCK — expired batches are filtered out; if none remain, throw.
 *   WARN_ONLY  — expired batches allowed but populated into warnings[].
 */

import { istMidnightUtc } from '../../lib/date.js'
import {
  expiredBatchError,
  allBatchesExpiredError,
} from '../../lib/errors.js'
import type { BatchClaim } from './batch-claim.types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExpiryPolicy = 'WARN_ONLY' | 'HARD_BLOCK'

export interface BatchForPolicy {
  id: string
  batchNumber: string
  expiryDate: Date | null
  productId: string
  productName: string
  currentStock: number
  costPriceAtClaim?: bigint | null
}

export interface ExpiredInfo {
  batchId: string
  batchNumber: string
  expiryDate: Date
  productId: string
  productName: string
}

export interface ExpiryWarning {
  type: 'EXPIRED_BATCH'
  batchId: string
  batchNumber: string
  expiryDate: Date
  productId: string
  productName: string
}

export interface PolicyResult {
  /** Batches allowed to proceed (filtered or full, depending on policy). */
  allowed: BatchClaim[]
  /** Batches that were expired — non-empty only when WARN_ONLY. */
  expired: ExpiredInfo[]
  /** Human-readable warnings to surface in the API response (200 body). */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// isExpired — pure predicate
// ---------------------------------------------------------------------------

/**
 * Returns true when a batch is expired as of IST midnight on `asOf`.
 * Null expiryDate → never expired (no-expiry batches; R3 in risk register).
 */
export function isExpired(
  batch: Pick<BatchForPolicy, 'expiryDate'>,
  asOf: Date = istMidnightUtc()
): boolean {
  if (batch.expiryDate == null) return false
  // expiryDate is end-of-day inclusive: batch expires AFTER the expiry date.
  // If expiryDate <= today-midnight-UTC, the batch has expired.
  return batch.expiryDate <= asOf
}

// ---------------------------------------------------------------------------
// evaluateBatchPolicy — main evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate a set of batches against the business expiry policy.
 *
 * @param batches  Candidate batch rows (currentStock > 0, not deleted).
 * @param policy   Business.expiredBatchPolicy value.
 * @param asOf     IST midnight in UTC; defaults to now. Inject in tests.
 *
 * HARD_BLOCK: expired batches removed from `allowed`; if no allowed remain,
 *   throws ALL_BATCHES_EXPIRED (409).
 *
 * WARN_ONLY: expired batches stay in `allowed`; warnings[] populated.
 */
export function evaluateBatchPolicy(params: {
  batches: BatchForPolicy[]
  policy: ExpiryPolicy
  asOf?: Date
}): PolicyResult {
  const { batches, policy } = params
  const asOf = params.asOf ?? istMidnightUtc()

  const allowed: BatchClaim[] = []
  const expired: ExpiredInfo[] = []
  const warnings: string[] = []

  for (const b of batches) {
    const expired_ = isExpired(b, asOf)

    if (!expired_) {
      allowed.push({
        batchId: b.id,
        expiryDate: b.expiryDate,
        qtyTaken: b.currentStock,
        costPriceAtClaim: b.costPriceAtClaim ?? null,
      })
      continue
    }

    // Batch is expired
    const info: ExpiredInfo = {
      batchId: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate as Date,
      productId: b.productId,
      productName: b.productName,
    }
    expired.push(info)

    if (policy === 'WARN_ONLY') {
      // Include in allowed so FEFO can draw from it
      allowed.push({
        batchId: b.id,
        expiryDate: b.expiryDate,
        qtyTaken: b.currentStock,
        costPriceAtClaim: b.costPriceAtClaim ?? null,
      })
      warnings.push(
        `Batch "${b.batchNumber}" (${b.productName}) expired on ${
          (b.expiryDate as Date).toISOString().split('T')[0]
        } — sold under WARN_ONLY policy`
      )
    }
    // HARD_BLOCK: skip — not added to allowed
  }

  if (policy === 'HARD_BLOCK' && allowed.length === 0 && batches.length > 0) {
    throw allBatchesExpiredError({
      productId: batches[0].productId,
      productName: batches[0].productName,
      expiredBatchCount: expired.length,
    })
  }

  return { allowed, expired, warnings }
}

// ---------------------------------------------------------------------------
// checkSingleBatch — validate a client-supplied batchId after row-lock
// ---------------------------------------------------------------------------

/**
 * TOCTOU post-lock check for client-supplied batchId path.
 * Throws EXPIRED_BATCH (409) when policy=HARD_BLOCK and batch is expired.
 * Returns an ExpiryWarning (or null) when WARN_ONLY.
 */
export function checkSingleBatch(
  batch: BatchForPolicy,
  policy: ExpiryPolicy,
  asOf: Date = istMidnightUtc()
): ExpiryWarning | null {
  if (!isExpired(batch, asOf)) return null

  if (policy === 'HARD_BLOCK') {
    throw expiredBatchError({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate as Date,
      productId: batch.productId,
      productName: batch.productName,
    })
  }

  return {
    type: 'EXPIRED_BATCH',
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate as Date,
    productId: batch.productId,
    productName: batch.productName,
  }
}
