/**
 * Cron scheduler — registers all background jobs at server boot.
 *
 * Jobs run in IST (Asia/Kolkata). Each job is isolated per business
 * with its own try/catch so one failure doesn't abort others.
 *
 * Usage: call initCronJobs() from app bootstrap (app.ts or index.ts).
 */

import cron from 'node-cron'
import { prisma } from './prisma.js'
import logger from './logger.js'
import { evaluateOpenPtps } from '../services/collections/promise-to-pay-eval.service.js'
import { runRecurringTick } from '../services/recurring/recurring-runner.service.js'
import {
  runBatchExpiryAlertsJob,
  runRecurringRunsCleanup,
  runExpenseRecurringGenerator,
} from './cron-job-runners.js'
import { initNotificationCronJobs } from '../services/notifications/notification-cron.js'
import { notifyPtpDueToday } from '../services/notifications/notification-hooks.js'
import { runGraceExpiryJob } from '../services/subscription/cron-grace-expiry.js'
import { runTrialEndJob } from '../services/subscription/cron-trial-end.js'
import { runMandateReminderJob } from '../services/subscription/cron-mandate-reminder.js'
import { runLoyaltyExpiryCron } from '../services/loyalty/loyalty-expiry.cron.js'
import { runPinGc } from '../jobs/pin-gc.job.js'
import { runImportRetentionJob } from '../jobs/import-retention.cron.js'
import os from 'os'

let initialized = false

/** Stable worker id used for cron claim ownership. */
function makeWorkerId(): string {
  return `${os.hostname()}:${process.pid}`
}

export function initCronJobs(): void {
  if (initialized) return
  initialized = true

  // Daily 01:00 IST — evaluate OPEN PTPs past their promise date
  cron.schedule(
    '0 1 * * *',
    () => void runPtpEvaluator(),
    { timezone: 'Asia/Kolkata' },
  )

  // Every 15 min IST — generate due recurring invoices
  const workerId = makeWorkerId()
  cron.schedule(
    '*/15 * * * *',
    () => void runRecurringGenerator(workerId),
    { timezone: 'Asia/Kolkata' },
  )

  // Daily 03:00 IST — clean up RecurringInvoiceRun rows older than 90 days
  cron.schedule(
    '0 3 * * *',
    () => void runRecurringRunsCleanup(),
    { timezone: 'Asia/Kolkata' },
  )

  // Daily 02:30 IST — generate PENDING_CONFIRMATION expenses from active templates
  cron.schedule(
    '30 2 * * *',
    () => void runExpenseRecurringGenerator(),
    { timezone: 'Asia/Kolkata' },
  )

  // Daily 06:00 IST (30 0 * * * UTC) — scan batch expiry dates and create alerts
  cron.schedule(
    '30 0 * * *',
    () => void runBatchExpiryAlertsJob(),
    { timezone: 'UTC' },
  )

  // Subscription: grace expiry + overflow enforce @ 06:00 IST
  cron.schedule(
    '0 6 * * *',
    () => void runGraceExpiryJob().catch((e) => logger.error('cron.grace_expiry.fatal', { error: e instanceof Error ? e.message : String(e) })),
    { timezone: 'Asia/Kolkata' },
  )

  // Subscription: trial end check @ 07:00 IST
  cron.schedule(
    '0 7 * * *',
    () => void runTrialEndJob().catch((e) => logger.error('cron.trial_end.fatal', { error: e instanceof Error ? e.message : String(e) })),
    { timezone: 'Asia/Kolkata' },
  )

  // Subscription: mandate pending reminder @ 08:00 IST
  cron.schedule(
    '0 8 * * *',
    () => void runMandateReminderJob().catch((e) => logger.error('cron.mandate_reminder.fatal', { error: e instanceof Error ? e.message : String(e) })),
    { timezone: 'Asia/Kolkata' },
  )

  // Epic D PR3 — Loyalty expiry @ 04:15 IST (architecture v5 / M1).
  // Scans LoyaltyLedger AC rows whose expiresAt < now and writes EX rows.
  // Idempotent: re-runs are no-ops (note sentinel '[expiry of ac:<id>]').
  cron.schedule(
    '15 4 * * *',
    () =>
      void runLoyaltyExpiryCron().catch((e) =>
        logger.error('cron.loyalty_expiry.fatal', {
          error: e instanceof Error ? e.message : String(e),
        })
      ),
    { timezone: 'Asia/Kolkata' }
  )

  // Notification engine cron jobs (PR10)
  initNotificationCronJobs()
  cron.schedule('30 3 * * *', () => void runPinGc().catch((e) => logger.error('cron.pin_gc.fatal', { error: e instanceof Error ? e.message : String(e) })), { timezone: 'Asia/Kolkata' })

  // Phase 7 — DPDP import retention. Hourly so the 24h post-commit
  // raw-purge window cannot drift > 1h and orphan-PARSING reaps fire
  // within ~ORPHAN_PARSING_REAP_MIN of crash. Wrapper never throws.
  cron.schedule('0 * * * *', () => void runImportRetentionJob(), {
    timezone: 'Asia/Kolkata',
  })

  logger.info('cron.registered', {
    jobs: [
      'ptp-evaluator @ 01:00 IST',
      'recurring-generator @ */15 IST',
      'recurring-runs-cleanup @ 03:00 IST',
      'expense-recurring-generator @ 02:30 IST',
      'batch-expiry-alerts @ 06:00 IST (30 0 UTC)',
      'notification-drain @ */1 IST',
      'notification-overdue-scan @ 08:00 IST',
      'notification-subscription-expiry @ 09:00 IST',
      'notification-retention-purge @ 02:00 IST Sunday',
      'notification-month-roll @ 00:05 IST 1st-of-month',
      'subscription-grace-expiry @ 06:00 IST',
      'subscription-trial-end @ 07:00 IST',
      'subscription-mandate-reminder @ 08:00 IST',
      'loyalty-expiry @ 04:15 IST', 'pin-gc @ 03:30 IST',
      'import-retention @ hourly IST',
    ],
  })
}


/**
 * Exported so tests / manual CLI can call it directly.
 */
export async function runRecurringGenerator(workerId?: string): Promise<void> {
  const wid = workerId ?? makeWorkerId()
  logger.info('recurring-generator.start', { workerId: wid })
  try {
    const summary = await runRecurringTick(wid)
    logger.info('recurring-generator.done', { workerId: wid, ...summary })
  } catch (e) {
    logger.error('recurring-generator.fatal', {
      workerId: wid,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export async function runPtpEvaluator(): Promise<void> {
  logger.info('ptp-evaluator.start')
  const asOf = new Date()

  // Today window for PTP_DUE_TODAY notifications
  const todayStart = new Date(asOf)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(asOf)
  todayEnd.setHours(23, 59, 59, 999)

  let cursor: string | undefined
  const PAGE = 50

  // Stream businesses in pages to avoid loading all into memory
  while (true) {
    const businesses = await prisma.business.findMany({
      where: { isActive: true },
      select: { id: true },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (businesses.length === 0) break

    for (const biz of businesses) {
      try {
        // No outer transaction: each PTP's update+audit pair gets its own
        // tiny $transaction inside evaluateOpenPtps, so one bad PTP doesn't
        // roll back all other PTPs for the same business.
        await evaluateOpenPtps(biz.id, asOf)
      } catch (e) {
        logger.error('ptp-evaluator.business_error', {
          businessId: biz.id,
          error: e instanceof Error ? e.message : String(e),
        })
      }

      // PTP_DUE_TODAY — notify for open PTPs due today (non-blocking)
      try {
        const dueTodayPtps = await prisma.promiseToPay.findMany({
          where: {
            businessId: biz.id,
            status: 'OPEN',
            isDeleted: false,
            promiseDate: { gte: todayStart, lte: todayEnd },
          },
          select: { id: true, amountPaise: true, promiseDate: true },
        })
        for (const ptp of dueTodayPtps) {
          void notifyPtpDueToday({ businessId: biz.id, ptpId: ptp.id, amountPaise: ptp.amountPaise, promiseDate: ptp.promiseDate })
        }
      } catch (e) {
        logger.error('ptp-due-today.error', { businessId: biz.id, error: e instanceof Error ? e.message : String(e) })
      }
    }

    cursor = businesses[businesses.length - 1].id
    if (businesses.length < PAGE) break
  }

  logger.info('ptp-evaluator.complete')
}

// Re-exported for back-compat with test imports.
export { runBatchExpiryAlertsJob, runRecurringRunsCleanup, runExpenseRecurringGenerator }
