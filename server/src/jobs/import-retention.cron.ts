// PII: logger / audit calls MUST NOT include raw cell content — only
// jobId, businessId, userId, counts (S9).
/**
 * Phase 7 — Import Engine · DPDP retention cron (API.7)
 *
 * Three passes per tick:
 *   1. Post-commit raw purge — COMMITTED jobs older than
 *      RAW_RETENTION_HOURS (24h): NULL `raw` + `normalized` on every
 *      ImportJobRow. DPDP §8 minimisation: PII may only be retained
 *      for the time strictly required to perform the operation; once
 *      parties are created we no longer need the raw cells.
 *   2. Orphan PARSING reap — jobs stuck in PARSING > ORPHAN_PARSING_REAP_MIN
 *      (5min) → status FAILED + audit row. Covers a crashed parse process.
 *   3. Expiry — jobs whose `expiresAt` has passed AND are still in a
 *      non-terminal state → status EXPIRED + NULL raw payloads + audit.
 *
 * Idempotent: re-runs over already-scrubbed rows are no-ops (UPDATE
 * matches 0 rows; counts reflect that).
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §9 (retention) + §10 (audit)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S9 (PII scrub) / M5 (DPDP)
 */

import { prisma as defaultPrisma } from '../lib/prisma.js'
import type { ExtendedPrismaClient } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import {
  RAW_RETENTION_HOURS,
  ORPHAN_PARSING_REAP_MIN,
} from '../constants/import.constants.js'
import { emitExpired, emitParseTimeout } from '../services/import/audit-emit.js'

export interface RetentionSummary {
  postCommitJobsPurged: number
  postCommitRowsPurged: number
  orphanParsingReaped: number
  expiredJobs: number
  expiredRowsPurged: number
}

const ZERO: RetentionSummary = {
  postCommitJobsPurged: 0,
  postCommitRowsPurged: 0,
  orphanParsingReaped: 0,
  expiredJobs: 0,
  expiredRowsPurged: 0,
}

interface RunOpts {
  prisma?: ExtendedPrismaClient
  now?: Date
}

/**
 * One-shot retention pass. Exported so node-cron, tests, and CLIs can
 * call it directly.
 */
export async function runImportRetentionCron(
  opts: RunOpts = {},
): Promise<RetentionSummary> {
  const prisma = opts.prisma ?? defaultPrisma
  const now = opts.now ?? new Date()
  const summary: RetentionSummary = { ...ZERO }

  // ── Pass 1: post-commit raw purge ───────────────────────────────────
  const purgeCutoff = new Date(
    now.getTime() - RAW_RETENTION_HOURS * 60 * 60 * 1000,
  )
  const postCommitJobs = await prisma.importJob.findMany({
    where: { status: 'COMMITTED', committedAt: { lt: purgeCutoff } },
    select: { id: true },
  })
  for (const job of postCommitJobs) {
    // Prisma drops `null` writes to Json columns via updateMany, so we
    // NULL the raw + normalized JSON via raw SQL — bounded by jobId
    // (no cross-tenant blast radius) per S9.
    const purgedCount = await prisma.$executeRaw`
      UPDATE "ImportJobRow"
      SET "raw" = NULL, "normalized" = NULL
      WHERE "jobId" = ${job.id}
        AND ("raw" IS NOT NULL OR "normalized" IS NOT NULL)
    `
    if (purgedCount > 0) {
      summary.postCommitJobsPurged += 1
      summary.postCommitRowsPurged += Number(purgedCount)
    }
  }

  // ── Pass 2: orphan PARSING reap ─────────────────────────────────────
  const orphanCutoff = new Date(
    now.getTime() - ORPHAN_PARSING_REAP_MIN * 60 * 1000,
  )
  const orphans = await prisma.importJob.findMany({
    where: { status: 'PARSING', updatedAt: { lt: orphanCutoff } },
    select: { id: true, businessId: true, userId: true },
  })
  for (const o of orphans) {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.importJob.updateMany({
        where: { id: o.id, status: 'PARSING' },
        data: { status: 'FAILED', counts: { failedReason: 'PARSE_TIMEOUT' } },
      })
      if (upd.count > 0) {
        await emitParseTimeout(tx, {
          businessId: o.businessId,
          userId: o.userId,
          jobId: o.id,
        })
        summary.orphanParsingReaped += 1
      }
    })
  }

  // ── Pass 3: expired non-terminal jobs ───────────────────────────────
  const expirable = await prisma.importJob.findMany({
    where: {
      expiresAt: { lt: now },
      status: {
        notIn: ['COMMITTED', 'FAILED', 'CANCELLED', 'EXPIRED'],
      },
    },
    select: { id: true, businessId: true, userId: true },
  })
  for (const e of expirable) {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.importJob.updateMany({
        where: {
          id: e.id,
          expiresAt: { lt: now },
          status: {
            notIn: ['COMMITTED', 'FAILED', 'CANCELLED', 'EXPIRED'],
          },
        },
        data: { status: 'EXPIRED' },
      })
      if (upd.count > 0) {
        await tx.$executeRaw`UPDATE "ImportJobRow" SET "raw" = NULL, "normalized" = NULL WHERE "jobId" = ${e.id}`
        const rowsAffected = await tx.importJobRow.count({
          where: { jobId: e.id },
        })
        await emitExpired(tx, {
          businessId: e.businessId,
          userId: e.userId,
          jobId: e.id,
          expiredAt: now,
        })
        summary.expiredJobs += 1
        summary.expiredRowsPurged += rowsAffected
      }
    })
  }

  logger.info('import.retention.done', { ...summary })
  return summary
}

/** Wrapper for cron-scheduler invocation; never throws. */
export async function runImportRetentionJob(): Promise<void> {
  try {
    await runImportRetentionCron()
  } catch (e) {
    logger.error('import.retention.fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
