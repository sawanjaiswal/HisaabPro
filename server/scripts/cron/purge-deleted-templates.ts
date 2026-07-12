/**
 * Purge soft-deleted invoice templates — daily 03:00 IST, 90-day retention.
 *
 * ARCHITECTURE §9. The only accumulating rows in this feature are soft-deleted
 * templates (TemplateDefault ≤9/business + InvoiceSettings 1/business are
 * self-bounded). This hard-deletes rows where `isDeleted = true AND deletedAt <
 * now()-90d`, backed by `@@index([deletedAt])`.
 *
 * The soft-delete extension only rewrites READ operations (adds isDeleted:false);
 * `deleteMany` passes through untouched, so an explicit `isDeleted:true` predicate
 * yields a genuine hard delete of already-soft-deleted rows.
 *
 * Observability: logs rows-deleted/run — a 0-forever value means the cron is dead.
 */

import { prisma as defaultPrisma } from '../../src/lib/prisma.js'
import type { ExtendedPrismaClient } from '../../src/lib/prisma.js'
import logger from '../../src/lib/logger.js'

/** Retention window before a soft-deleted template is hard-purged. */
export const TEMPLATE_RETENTION_DAYS = 90

interface RunOpts {
  prisma?: ExtendedPrismaClient
  now?: Date
}

/** One-shot purge pass. Exported for node-cron, tests, and CLI. */
export async function runPurgeDeletedTemplates(opts: RunOpts = {}): Promise<number> {
  const prisma = opts.prisma ?? defaultPrisma
  const now = opts.now ?? new Date()
  const cutoff = new Date(now.getTime() - TEMPLATE_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const result = await prisma.invoiceTemplate.deleteMany({
    where: { isDeleted: true, deletedAt: { lt: cutoff } },
  })

  logger.info('templates.purge.done', { deleted: result.count, cutoff: cutoff.toISOString() })
  return result.count
}

/** Wrapper for cron-scheduler invocation; never throws. */
export async function runPurgeDeletedTemplatesJob(): Promise<void> {
  try {
    await runPurgeDeletedTemplates()
  } catch (e) {
    logger.error('templates.purge.fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
