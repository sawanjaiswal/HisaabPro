/**
 * Phase 7 — Import Engine · PARTIES commit branch (Slice 7.1B PR1)
 *
 * Owns the STAGED-row pass for `ImportJob.entity = 'parties'`. Extracted
 * from `commit.helpers.ts` so the helpers file stays ≤250 LOC and the
 * parties / products branches live next to each other (`commit-products
 * .service.ts`).
 *
 * Dual-write contract (7.1B Gap 1):
 *   While the `createdPartyId → createdEntityId` rename is in its
 *   expand→backfill→contract overlap, every newly-bound row writes BOTH
 *   columns. `hasCreatedEntityIdColumn(tx)` (M8) gates the new column —
 *   on environments where Migration B1 hasn't shipped, only `createdPartyId`
 *   is written. PR-followup Migration D drops `createdPartyId` and the
 *   dual-write disappears.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §6.1 (commit lock model)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1B.md §8 (split + dual-write)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M3, S6, S9 (PII safety)
 */

// PII: logger / audit calls MUST NOT include raw cell content —
// only jobId, sourceIndex, counts (S9).
import logger from '../../lib/logger.js'
import { CHUNK_SIZE } from '../../constants/import.constants.js'
import {
  hasCreatedEntityIdColumn,
  type ChunkResult,
  type StagedRowMin,
  type Tx,
} from './commit.helpers.js'

interface PartyNormalized {
  name: string
  phoneE164?: string
  email?: string
  gstin?: string
  address?: string
  openingBalancePaise?: number
}

async function commitOnePartyRow(
  tx: Tx,
  args: { row: StagedRowMin; businessId: string; userId: string; jobId: string },
): Promise<string | null> {
  const { row, businessId, userId, jobId } = args
  const n = row.normalized as PartyNormalized
  const party = await tx.party.create({
    data: {
      businessId,
      name: n.name,
      phone: n.phoneE164 ?? null,
      email: n.email ?? null,
      gstin: n.gstin ?? null,
      notes: n.address ?? null,
      importJobId: jobId,
      importedBy: userId,
    },
    select: { id: true },
  })
  if (n.openingBalancePaise && n.openingBalancePaise !== 0) {
    await tx.openingBalance.create({
      data: {
        partyId: party.id,
        amount: Math.abs(n.openingBalancePaise),
        type: n.openingBalancePaise > 0 ? 'RECEIVABLE' : 'PAYABLE',
        asOfDate: new Date(),
      },
    })
  }
  // Dual-write gate (M8). The probe is cheap and cached per-process; the
  // value is read once and reused across the chunk loop in `commitChunk`.
  const dualWrite = await hasCreatedEntityIdColumn(tx)
  // Row-level guard: only bind if still STAGED and unbound.
  const claimed = await tx.importJobRow.updateMany({
    where: { id: row.id, status: 'STAGED', createdPartyId: null },
    data: dualWrite
      ? {
          status: 'COMMITTED',
          createdPartyId: party.id,
          createdEntityId: party.id,
        }
      : { status: 'COMMITTED', createdPartyId: party.id },
  })
  if (claimed.count !== 1) {
    logger.warn('import.commit.row_race', { rowId: row.id, jobId })
    return null
  }
  return party.id
}

/**
 * Commit one chunk of ≤CHUNK_SIZE parties rows. Emits ONE batched
 * `parties.imported_batch` AuditLog row per chunk (S6) rather than one
 * row per party.
 */
export async function commitChunkParties(
  tx: Tx,
  args: { jobId: string; businessId: string; userId: string },
): Promise<ChunkResult> {
  const candidates = await tx.$queryRaw<StagedRowMin[]>`
    SELECT id, "sourceIndex", normalized, "matchedPartyId"
    FROM "ImportJobRow"
    WHERE "jobId" = ${args.jobId}
      AND status = 'STAGED'
      AND "createdPartyId" IS NULL
    ORDER BY "sourceIndex" ASC
    LIMIT ${CHUNK_SIZE}
    FOR UPDATE
  `
  if (candidates.length === 0) {
    return { createdPartyIds: [], sourceIndices: [], done: true }
  }
  const createdPartyIds: string[] = []
  const sourceIndices: number[] = []
  for (const row of candidates) {
    const partyId = await commitOnePartyRow(tx, {
      row,
      businessId: args.businessId,
      userId: args.userId,
      jobId: args.jobId,
    })
    if (partyId) {
      createdPartyIds.push(partyId)
      sourceIndices.push(row.sourceIndex)
    }
  }
  await tx.auditLog.create({
    data: {
      businessId: args.businessId,
      entityType: 'ImportJob',
      entityId: args.jobId,
      userId: args.userId,
      action: 'CREATE',
      changes: {
        event: 'parties.imported_batch',
        partyIds: createdPartyIds,
        sourceIndices,
      },
    },
  })
  return {
    createdPartyIds,
    sourceIndices,
    done: candidates.length < CHUNK_SIZE,
  }
}

/**
 * Back-compat alias — `commit.service.ts` (parties path pre-B1) imported
 * `commitChunk` from helpers. Keep the name available so the existing
 * dispatcher can call either branch via a single contract.
 */
export const commitChunk = commitChunkParties
