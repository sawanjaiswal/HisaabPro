/**
 * Race-safe claim for recurring invoice schedules.
 *
 * Uses a single atomic UPDATE … FOR UPDATE SKIP LOCKED to ensure
 * parallel cron pods never claim the same schedule row.
 *
 * A stale claim (worker crashed mid-run) is re-claimable after `staleMinutes`.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import type { RecurringInvoice } from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClaimResult extends RecurringInvoice {}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

/**
 * Atomically claims up to `batchSize` ACTIVE schedules whose nextRunDate
 * has arrived. Returns the full rows of claimed schedules.
 *
 * Stale claims (claimedAt older than `staleMinutes`) are also re-claimable —
 * this recovers schedules from crashed workers.
 */
export async function claimDueSchedules(
  workerId: string,
  batchSize = 20,
  staleMinutes = 5,
): Promise<ClaimResult[]> {
  const now = new Date()
  const staleThreshold = new Date(now.getTime() - staleMinutes * 60_000)

  // Atomic claim — returns only the id column for the UPDATE
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "RecurringInvoice"
    SET "claimedAt" = ${now}, "claimedBy" = ${workerId}
    WHERE id IN (
      SELECT id FROM "RecurringInvoice"
      WHERE status = 'ACTIVE'
        AND "isDeleted" = false
        AND "nextRunDate" <= ${now}
        AND ("claimedAt" IS NULL OR "claimedAt" < ${staleThreshold})
      ORDER BY "nextRunDate" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `

  if (claimed.length === 0) return []

  const ids = claimed.map((r) => r.id)

  logger.info('recurring.claim.acquired', {
    workerId,
    count: ids.length,
    ids,
  })

  // Fetch full rows so the runner has all the fields it needs
  const rows = await prisma.recurringInvoice.findMany({
    where: { id: { in: ids } },
    take: batchSize,
  })

  return rows
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

/**
 * Release a claim on a single schedule (called after successful generation
 * OR on failure so the next tick can retry).
 */
export async function releaseSchedule(id: string): Promise<void> {
  await prisma.recurringInvoice.update({
    where: { id },
    data: { claimedAt: null, claimedBy: null },
  })
}
