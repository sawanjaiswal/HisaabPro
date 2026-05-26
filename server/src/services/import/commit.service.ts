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
import type {
  AuthContext,
  DedupResolution,
} from '../../types/import.types.js'
import {
  acquireBusinessLock,
  assertCommitBind,
  lockJob,
} from './commit.helpers.js'
import { pickCommitChunk } from './commit-dispatcher.js'
import { applyDedupResolutions } from './commit.resolutions.js'

export interface CommitImportJobArgs {
  jobId: string
  auth: AuthContext
  commitToken: string
  idempotencyKey: string
  prisma: ExtendedPrismaClient
  /**
   * API.8 — optional per-row decisions for DUPLICATE_* rows. Applied
   * inside the same $transaction as the STAGED-row commit pass.
   */
  dedupResolutions?: DedupResolution[]
}

export interface CommitResult {
  committedCount: number
  skippedCount: number
  errorCount: number
  createdPartyIds: string[]
  /**
   * Phase 7 · 7.1B — created entity ids (Party for entity='parties',
   * Product for entity='product'). Same array as createdPartyIds during
   * the expand→backfill→contract overlap; PR-followup drops createdPartyIds.
   */
  createdEntityIds: string[]
  /** API.8 — party ids mutated by OVERWRITE resolutions (S6 batched). */
  overwrittenPartyIds: string[]
  partial: boolean
}

export async function commitImportJob(
  args: CommitImportJobArgs,
): Promise<CommitResult> {
  const {
    jobId,
    auth,
    commitToken,
    idempotencyKey,
    prisma,
    dedupResolutions,
  } = args
  const allCreated: string[] = []
  let overwrittenPartyIds: string[] = []
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

      // API.8 — apply per-row dedup resolutions BEFORE the STAGED pass.
      // CREATE_NEW flips DUP → STAGED so the chunk loop picks them up.
      // OVERWRITE updates matched parties + marks rows COMMITTED itself.
      if (dedupResolutions && dedupResolutions.length > 0) {
        const resolved = await applyDedupResolutions(tx, {
          jobId,
          auth,
          resolutions: dedupResolutions,
        })
        overwrittenPartyIds = resolved.overwrittenPartyIds
      }

      // 7.1B — pick parties|product branch from the locked job's entity.
      // Lookup happens INSIDE the tx so a concurrent entity flip is
      // impossible — the lock guarantees `job` is the row we're acting on.
      const commitChunkFn = pickCommitChunk(job.entity)

      // Chunked loop — at most MAX_CREATED_PARTY_IDS retained for audit.
      for (;;) {
        const chunk = await commitChunkFn(tx, {
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
          createdEntityIds: allCreated,
          counts: {
            committed: allCreated.length,
            overwritten: overwrittenPartyIds.length,
            errors: errorRows,
            skipped: skippedRows,
          },
        },
      })
      await emitCommitted(tx, auth, {
        jobId,
        committedCount: allCreated.length + overwrittenPartyIds.length,
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
          createdEntityIds: allCreated,
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
    committedCount: allCreated.length + overwrittenPartyIds.length,
    skippedCount,
    errorCount,
    createdEntityIds: allCreated,
    createdPartyIds: allCreated,
    overwrittenPartyIds,
    partial,
  }
}
