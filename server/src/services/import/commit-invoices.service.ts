/**
 * Phase 7 · 7.1C PR-C3 — INVOICE commit branch.
 *
 * Single chunk tx (no nested $transaction). Statement order per ARCH §6:
 *   P0  acquireBusinessLock(tx)
 *   P1  load partySnapshot (single SELECT, this chunk's referenced names)
 *   P2  load productSnapshot (single SELECT, this chunk's SKUs + names)
 *   P2.5 reResolveProductsInPlace (ARCH M6) — mutate row.normalized in-mem
 *   P3  count BLOCKED → throw COMMIT_BLOCKED_PRODUCT_NOT_FOUND (S5 sample
 *       only at DEBUG)
 *   PER-INVOICE (commit-one-invoice.ts):
 *     1. fly-create party (advisory xact lock — M10 length-prefix key)
 *     2. tx.document.create
 *     3. tx.documentLineItem.createMany (S8: P2003 → PRODUCT_DELETED_DURING_COMMIT)
 *     4. tx.importJobRow.updateMany guarded — count=0 → CONCURRENT_COMMIT_RACE
 *   P7  emitInvoicesImportedBatch (one audit row per chunk — ARCH S1)
 *
 * `ChunkResult.createdPartyIds` carries DOCUMENT IDs (precedent: 7.1B
 * commit-products carries Product IDs in the same field).
 */

import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { CHUNK_SIZE } from '../../constants/import.constants.js'
import {
  acquireBusinessLock,
  type ChunkResult,
  type Tx,
} from './commit.helpers.js'
import { emitInvoicesImportedBatch } from './audit-emit.js'
import { loadPartySnapshot } from './invoice/party-resolver.js'
import { loadProductSnapshot } from './invoice/product-resolver.js'
import { reResolveProductsInPlace } from './invoice/product-resolver-reresolve.js'
import {
  collectMissingSkuSample,
  collectPartyCandidates,
  collectProductCandidates,
  countBlockedRows,
  type StagedInvoiceRowMin,
} from './invoice/commit-invoices.helpers.js'
import { commitOneInvoice } from './invoice/commit-one-invoice.js'

export async function commitChunkInvoices(
  tx: Tx,
  args: { jobId: string; businessId: string; userId: string },
): Promise<ChunkResult> {
  await acquireBusinessLock(tx, args.businessId)

  const stagedRows = await tx.$queryRaw<StagedInvoiceRowMin[]>`
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

  // Pre-flight — single-roundtrip snapshots.
  const partySnapshot = await loadPartySnapshot(
    tx,
    args.businessId,
    collectPartyCandidates(stagedRows),
  )
  const productSnapshot = await loadProductSnapshot(
    tx,
    args.businessId,
    collectProductCandidates(stagedRows),
  )
  // ARCH M6 — stale resolution sweep (mutates row.normalized in-mem only).
  const flipped = reResolveProductsInPlace(
    stagedRows.map((r) => ({ normalized: r.normalized })),
    productSnapshot,
  )
  if (flipped > 0) {
    logger.debug('import.invoice.stale_reresolve_flipped', {
      jobId: args.jobId,
      flipped,
    })
  }

  const blockedCount = countBlockedRows(stagedRows)
  if (blockedCount > 0) {
    const sample = collectMissingSkuSample(stagedRows, 5)
    // S5 — SKU sample DEBUG only, never INFO. Echoed in AppError payload
    // for the FE banner; resolver was businessId-scoped so no cross-tenant leak.
    logger.debug('import.invoice.commit_blocked.sku_sample', {
      jobId: args.jobId,
      sample,
    })
    throw new AppError(
      ErrorCode.COMMIT_BLOCKED_PRODUCT_NOT_FOUND,
      409,
      'Commit blocked — at least one line item has no resolvable product.',
      { blockedRowCount: blockedCount, missingSkuSample: sample },
    )
  }

  const documentIds: string[] = []
  const sourceIndices: number[] = []
  const documentNumbers: string[] = []
  const partyIds: string[] = []
  const grandTotals: number[] = []
  for (const row of stagedRows) {
    const r = await commitOneInvoice(tx, row, args, partySnapshot)
    documentIds.push(r.documentId)
    sourceIndices.push(row.sourceIndex)
    documentNumbers.push(r.documentNumber ?? '')
    partyIds.push(r.partyId)
    grandTotals.push(r.grandTotal)
  }

  await emitInvoicesImportedBatch(tx, {
    jobId: args.jobId,
    businessId: args.businessId,
    userId: args.userId,
    documentIds,
    documentNumbers,
    partyIds,
    grandTotals,
    sourceIndices,
  })

  return {
    // ChunkResult shape compat — `createdPartyIds` carries DOCUMENT IDs.
    createdPartyIds: documentIds,
    sourceIndices,
    done: stagedRows.length < CHUNK_SIZE,
  }
}
