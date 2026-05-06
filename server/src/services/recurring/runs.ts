/**
 * Query + pagination helpers for RecurringInvoiceRun history.
 * Also exposes a cleanup helper to prune runs older than N days.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Run history
// ---------------------------------------------------------------------------

export interface RunsListQuery {
  cursor?: string
  limit?: number
}

/**
 * Paginated run history for a single recurring schedule (cursor-based).
 * Ordered by ranAt DESC (most recent first).
 */
export async function listRuns(
  businessId: string,
  recurringInvoiceId: string,
  query: RunsListQuery = {},
) {
  const limit = Math.min(query.limit ?? 10, 50)

  const items = await prisma.recurringInvoiceRun.findMany({
    where: {
      businessId,
      recurringInvoiceId,
      isDeleted: false,
    },
    orderBy: { ranAt: 'desc' },
    take: limit + 1,
    ...(query.cursor
      ? { skip: 1, cursor: { id: query.cursor } }
      : {}),
    select: {
      id: true,
      scheduledFor: true,
      ranAt: true,
      status: true,
      generatedDocumentId: true,
      errorMessage: true,
      warning: true,
      retryCount: true,
      triggeredBy: true,
      idempotencyKey: true,
    },
  })

  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return { items: page, nextCursor }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Delete RecurringInvoiceRun rows (soft-delete) older than `days` days.
 * Used by the nightly cleanup cron (PR6).
 *
 * Soft-deletes only — hard deletes would lose audit history.
 */
export async function deleteRunsOlderThan(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const result = await prisma.recurringInvoiceRun.updateMany({
    where: {
      ranAt: { lt: cutoff },
      isDeleted: false,
    },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  })

  logger.info('recurring.runs.cleanup', { days, deleted: result.count })
  return result.count
}
