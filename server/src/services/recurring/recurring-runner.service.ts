/**
 * Recurring invoice runner — the cron tick entry point.
 *
 * Each tick:
 *  1. Claim a batch of due ACTIVE schedules (atomic, race-safe).
 *  2. Generate one invoice per claimed schedule (isolated per-schedule tx).
 *  3. Log aggregate summary.
 *
 * No outer transaction across the batch — per audit lesson F-06.
 * Each schedule's success/failure is independent.
 */

import logger from '../../lib/logger.js'
import { claimDueSchedules } from './recurring-claim.service.js'
import { generateInvoiceForSchedule } from './recurring-generation.service.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TickSummary {
  claimed: number
  success: number
  skipped: number
  failed: number
  durationMs: number
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Process all due recurring schedules for this cron tick.
 * @param workerId  Stable identifier for this pod/process (hostname:pid).
 */
export async function runRecurringTick(workerId: string): Promise<TickSummary> {
  const start = Date.now()

  logger.info('recurring.tick.start', { workerId })

  const schedules = await claimDueSchedules(workerId, 20, 5)

  if (schedules.length === 0) {
    logger.info('recurring.tick.no_work', { workerId })
    return { claimed: 0, success: 0, skipped: 0, failed: 0, durationMs: Date.now() - start }
  }

  let success = 0
  let skipped = 0
  let failed = 0

  for (const schedule of schedules) {
    const result = await generateInvoiceForSchedule(schedule.id, { manual: false })

    switch (result.status) {
      case 'SUCCESS':
        success++
        break
      case 'SKIPPED':
        skipped++
        break
      case 'FAILED':
        failed++
        logger.warn('recurring.tick.schedule_failed', {
          workerId,
          scheduleId: schedule.id,
          businessId: schedule.businessId,
          error: result.error,
        })
        break
    }
  }

  const summary: TickSummary = {
    claimed: schedules.length,
    success,
    skipped,
    failed,
    durationMs: Date.now() - start,
  }

  logger.info('recurring.tick.complete', { workerId, ...summary })

  return summary
}
