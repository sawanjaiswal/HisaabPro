/**
 * Phase 7 — Import Engine · Commit service helpers
 *
 * Extracted from commit.service.ts to keep both files <250 LOC.
 * Contains the row-level guard primitives + the M3 four-field binding
 * assertion + the advisory-lock / row-lock SQL.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §6.1
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M3, S6, S7
 */

import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { CHUNK_SIZE } from '../../constants/import.constants.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { AuthContext } from '../../types/import.types.js'

/**
 * The interactive-transaction callback param of the extended client. Using
 * `Prisma.TransactionClient` directly trips on the soft-delete extension's
 * model-extension generics (TS 2345). Pulling the inferred type from
 * `$transaction` keeps us in sync with whatever extensions are layered on.
 */
export type Tx = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface StagedRowMin {
  id: string
  sourceIndex: number
  normalized: unknown
  matchedPartyId: string | null
}

export interface JobLockRow {
  id: string
  businessId: string
  userId: string
  status: string
  commitToken: string | null
  idempotencyKey: string | null
  createdPartyIds: unknown
}

export interface ChunkResult {
  createdPartyIds: string[]
  sourceIndices: number[]
  done: boolean
}

/**
 * S7 — `hashtextextended(text, seed)` returns bigint; the older
 * `hashtext` int4 variant collides at ~77k businesses.
 */
export async function acquireBusinessLock(
  tx: Tx,
  businessId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended('import-commit', 0),
      hashtextextended(${businessId}, 0)
    )
  `
}

/** SELECT FOR UPDATE the ImportJob row by id (tenancy checked separately). */
export async function lockJob(
  tx: Tx,
  jobId: string,
): Promise<JobLockRow | null> {
  const rows = await tx.$queryRaw<JobLockRow[]>`
    SELECT id, "businessId", "userId", status, "commitToken",
           "idempotencyKey", "createdPartyIds"
    FROM "ImportJob"
    WHERE id = ${jobId}
    FOR UPDATE
  `
  return rows[0] ?? null
}

/**
 * M3 — assert that the locked job row matches all four binding fields:
 *   status='PREVIEWED' AND commitToken AND idempotencyKey AND (biz,user)
 * Any miss = 409 BAD_COMMIT_TOKEN (uniform response to avoid oracle).
 */
export function assertCommitBind(
  row: JobLockRow | null,
  expected: { commitToken: string; idempotencyKey: string; auth: AuthContext },
): asserts row is JobLockRow {
  const ok =
    row !== null &&
    row.status === 'PREVIEWED' &&
    row.commitToken === expected.commitToken &&
    row.idempotencyKey === expected.idempotencyKey &&
    row.businessId === expected.auth.businessId &&
    row.userId === expected.auth.userId
  if (!ok) {
    throw new AppError(
      ErrorCode.BAD_COMMIT_TOKEN,
      409,
      'Commit token does not match an active preview',
    )
  }
}

async function commitOneRow(
  tx: Tx,
  args: { row: StagedRowMin; businessId: string; userId: string; jobId: string },
): Promise<string | null> {
  const { row, businessId, userId, jobId } = args
  const n = row.normalized as {
    name: string
    phoneE164?: string
    email?: string
    gstin?: string
    address?: string
    openingBalancePaise?: number
  }
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
  // Row-level guard: only bind if still STAGED and unbound.
  const claimed = await tx.importJobRow.updateMany({
    where: { id: row.id, status: 'STAGED', createdPartyId: null },
    data: { status: 'COMMITTED', createdPartyId: party.id },
  })
  if (claimed.count !== 1) {
    logger.warn('import.commit.row_race', { rowId: row.id, jobId })
    return null
  }
  return party.id
}

/**
 * Commit one chunk of ≤CHUNK_SIZE rows. Emits ONE batched AuditLog row
 * per chunk (S6) rather than one row per party.
 */
export async function commitChunk(
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
    const partyId = await commitOneRow(tx, {
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
