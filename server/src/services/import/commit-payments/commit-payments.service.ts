/**
 * Phase 7 · 7.1D PR-D3 — PAYMENT commit branch.
 *
 * Single chunk tx (no nested $transaction). Statement order:
 *   P0   acquireBusinessLock(tx) — one commit per business in flight (S7)
 *   P1   SELECT FOR UPDATE staged rows (≤CHUNK_SIZE) — sourceIndex ASC
 *   P2   For each row, sequentially (NEVER Promise.all on tx):
 *          - allocateOnePayment() — resolver → enum guard → Σ guard →
 *            INSERT Payment → INSERT PaymentAllocation → updateMany guard
 *          - Outcome appended to per-row status array
 *   P3   emitPaymentsImportedBatch — one PII-safe audit row per chunk
 *
 * Row-local failures (OVER_ALLOCATION, INVOICE_NOT_FOUND, P2002
 * duplicate, mode-invalid) DO NOT throw out of the chunk — they're
 * absorbed into the per-row outcome array. ABORT-level failures
 * (unexpected Prisma 5xx, lock acquisition error) DO throw and the
 * chunk rolls back atomically.
 *
 * `ChunkResult.createdPartyIds` carries Payment IDs (precedent: 7.1C
 * carries Document IDs in the same field — name retained for the
 * dispatcher contract until PR-followup renames it).
 *
 * Authority:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §6 (chunk-tx flow)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md S7 (advisory lock)
 *   - BACKLOG.md PR-D3 acceptance spec
 */

import logger from '../../../lib/logger.js'
import { CHUNK_SIZE } from '../../../constants/import.constants.js'
import {
  acquireBusinessLock,
  type ChunkResult,
  type Tx,
} from '../commit.helpers.js'
import type { CommitChunkArgs } from '../commit-dispatcher.js'
import type { NormalizedPayment } from './types.js'
import { PaymentInvoiceResolver } from './payment-invoice-resolver.js'
import { allocateOnePayment, type AllocateOutcomeCode } from './allocate-one.js'
import { emitPaymentsImportedBatch } from './audit-emit.js'

interface StagedPaymentRow {
  id: string
  sourceIndex: number
  normalized: NormalizedPayment
}

export async function commitChunkPayments(
  tx: Tx,
  args: CommitChunkArgs,
): Promise<ChunkResult> {
  await acquireBusinessLock(tx, args.businessId)

  const stagedRows = await tx.$queryRaw<StagedPaymentRow[]>`
    SELECT id, "sourceIndex", normalized
    FROM "ImportJobRow"
    WHERE "jobId" = ${args.jobId}
      AND status = 'STAGED'
      AND "createdEntityId" IS NULL
    ORDER BY "sourceIndex" ASC
    LIMIT ${CHUNK_SIZE}
    FOR UPDATE
  `
  if (stagedRows.length === 0) {
    return { createdPartyIds: [], sourceIndices: [], done: true }
  }

  const resolver = new PaymentInvoiceResolver(tx, args.businessId)

  // Parallel-array audit batch — order tracks stagedRows ASC.
  const paymentIds: string[] = []
  const codes: AllocateOutcomeCode[] = []
  const sourceIndices: number[] = []
  const createdIds: string[] = []
  const createdSourceIndices: number[] = []

  for (const row of stagedRows) {
    // Sequential — Prisma $transaction client is NOT concurrency-safe.
    const outcome = await allocateOnePayment({
      tx,
      resolver,
      businessId: args.businessId,
      userId: args.userId,
      jobId: args.jobId,
      rowId: row.id,
      normalized: row.normalized,
    })
    sourceIndices.push(row.sourceIndex)
    codes.push(outcome.code)
    // Use empty string for skipped/error rows so arrays stay aligned.
    paymentIds.push(outcome.paymentId ?? '')
    if (outcome.code === 'COMMITTED' && outcome.paymentId) {
      createdIds.push(outcome.paymentId)
      createdSourceIndices.push(row.sourceIndex)
    }
  }

  await emitPaymentsImportedBatch(tx, {
    jobId: args.jobId,
    businessId: args.businessId,
    userId: args.userId,
    paymentIds,
    sourceIndices,
    codes,
  })

  // S9 — log counts only, NO partyId / amount / reference.
  logger.debug('import.payment.chunk_done', {
    jobId: args.jobId,
    chunkSize: stagedRows.length,
    committed: createdIds.length,
    overAllocated: codes.filter((c) => c === 'OVER_ALLOCATION').length,
    invoiceNotFound: codes.filter(
      (c) => c === 'COMMIT_BLOCKED_INVOICE_NOT_FOUND',
    ).length,
  })

  return {
    // ChunkResult contract — `createdPartyIds` carries Payment IDs
    // (precedent: invoices carry Document IDs in this field).
    createdPartyIds: createdIds,
    sourceIndices: createdSourceIndices,
    done: stagedRows.length < CHUNK_SIZE,
  }
}
