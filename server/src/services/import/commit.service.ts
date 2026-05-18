/**
 * Phase 7 — Import Engine · Commit service (API.5) — CRITICAL FILE
 *
 * Single-tx commit pipeline with five layers of defence against double-bind:
 *   1. `pg_advisory_xact_lock` (bigint, S7) → 1 commit per business in flight
 *   2. `SELECT ... FOR UPDATE` on the ImportJob row
 *   3. M3 four-field bind ASSERT (status + commitToken + idempotencyKey
 *      + (businessId, userId)) — wrong token / wrong user / wrong biz =
 *      0 rows → 409 BAD_COMMIT_TOKEN
 *   4. Row-level `WHERE status='STAGED' AND createdPartyId IS NULL`
 *      filters out rows already bound by an earlier (failed) attempt
 *   5. `@unique createdPartyId` at the DB makes a double-bind impossible
 *      even if (1)-(4) all leaked
 *
 * Helpers (lock + chunk + bind-assert) live in `commit.helpers.ts`.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §6.1
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M3, S6, S7, S8
 */

// PII: logger / audit calls MUST NOT include raw cell content — only
// jobId, sourceIndex, counts (S9).
import { AppError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { emitCommitted } from './audit-emit.js'
import { MAX_CREATED_PARTY_IDS } from '../../constants/import.constants.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { AuthContext } from '../../types/import.types.js'
import {
  acquireBusinessLock,
  assertCommitBind,
  commitChunk,
  lockJob,
} from './commit.helpers.js'

export interface CommitImportJobArgs {
  jobId: string
  auth: AuthContext
  commitToken: string
  idempotencyKey: string
  prisma: ExtendedPrismaClient
}

export interface CommitResult {
  committedCount: number
  skippedCount: number
  errorCount: number
  createdPartyIds: string[]
  partial: boolean
}

export async function commitImportJob(
  args: CommitImportJobArgs,
): Promise<CommitResult> {
  const { jobId, auth, commitToken, idempotencyKey, prisma } = args
  const allCreated: string[] = []
  let partial = false

  try {
    await prisma.$transaction(async (tx) => {
      await acquireBusinessLock(tx, auth.businessId)
      const job = await lockJob(tx, jobId)
      // M3 four-field binding (status + commitToken + idempotencyKey + biz,user)
      assertCommitBind(job, { commitToken, idempotencyKey, auth })

      // Move to COMMITTING + null commitToken so it can never be reused.
      await tx.importJob.update({
        where: { id: jobId },
        data: { status: 'COMMITTING', commitToken: null },
      })

      // Chunked loop — at most MAX_CREATED_PARTY_IDS retained for audit.
      for (;;) {
        const chunk = await commitChunk(tx, {
          jobId,
          businessId: auth.businessId,
          userId: auth.userId,
        })
        for (const id of chunk.createdPartyIds) {
          if (allCreated.length < MAX_CREATED_PARTY_IDS) allCreated.push(id)
        }
        if (chunk.done) break
      }

      const errorRows = await tx.importJobRow.count({
        where: { jobId, status: 'ERROR' },
      })
      const skippedRows = await tx.importJobRow.count({
        where: { jobId, status: 'SKIPPED' },
      })

      await tx.importJob.update({
        where: { id: jobId },
        data: {
          status: 'COMMITTED',
          committedAt: new Date(),
          createdPartyIds: allCreated,
          counts: {
            committed: allCreated.length,
            errors: errorRows,
            skipped: skippedRows,
          },
        },
      })
      await emitCommitted(tx, auth, {
        jobId,
        committedCount: allCreated.length,
        skippedCount: skippedRows,
        errorCount: errorRows,
        partyIdsCount: allCreated.length,
      })
    })
  } catch (err) {
    if (err instanceof AppError) throw err
    partial = true
    logger.error('import.commit.partial', {
      jobId,
      committed: allCreated.length,
      error: err instanceof Error ? err.message : String(err),
    })
    await prisma.importJob
      .update({
        where: { id: jobId },
        data: {
          status: 'PARTIALLY_COMMITTED',
          createdPartyIds: allCreated,
        },
      })
      .catch(() => undefined)
    throw err
  }

  const errorCount = await prisma.importJobRow.count({
    where: { jobId, status: 'ERROR' },
  })
  const skippedCount = await prisma.importJobRow.count({
    where: { jobId, status: 'SKIPPED' },
  })

  logger.info('import.commit.done', {
    jobId,
    committedCount: allCreated.length,
    errorCount,
  })
  return {
    committedCount: allCreated.length,
    skippedCount,
    errorCount,
    createdPartyIds: allCreated,
    partial,
  }
}
