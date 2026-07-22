/**
 * Cron scheduler — registers all background jobs at server boot.
 *
 * Jobs run in IST (Asia/Kolkata). Each job is isolated per business
 * with its own try/catch so one failure doesn't abort others.
 *
 * Usage: call initCronJobs() from app bootstrap (app.ts or index.ts).
 */

import cron from 'node-cron'
import logger from './logger.js'
import {
  runBatchExpiryAlertsJob,
  runRecurringRunsCleanup,
  runExpenseRecurringGenerator,
} from './cron-job-runners.js'
import { makeWorkerId, runRecurringGenerator, runPtpEvaluator } from './cron-runners.js'
import { initNotificationCronJobs } from '../services/notifications/notification-cron.js'
import { runGraceExpiryJob } from '../services/subscription/cron-grace-expiry.js'
import { runTrialEndJob } from '../services/subscription/cron-trial-end.js'
import { runMandateReminderJob } from '../services/subscription/cron-mandate-reminder.js'
import { runLoyaltyExpiryCron } from '../services/loyalty/loyalty-expiry.cron.js'
import { runPinGc } from '../jobs/pin-gc.job.js'
import { runImportRetentionJob } from '../jobs/import-retention.cron.js'
import { runShadowRetentionJob } from '../jobs/shadow-retention.cron.js'
import { runShadowCanaryJob } from '../jobs/shadow-canary.cron.js'
import { runShadowWatchdogJob } from '../jobs/shadow-watchdog.cron.js'
let initialized = false

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

  // ── Scoped-prisma shadow harness (Phase 5, Files #31-#33) ────────────────
  //
  // NONE of these three is wrapped in a mode check, and that is deliberate for
  // different reasons per job:
  //
  //   retention — must keep draining after a watch ends, or the DPDP ceilings
  //               stop applying the moment someone flips the flag back to `off`.
  //   canary    — self-skips on mode `off` inside the job, where the skip is
  //               visible and testable rather than hidden in this registration.
  //   watchdog  — SR-1. The failure it detects IS the mode var being lost, so a
  //               `if (mode === 'shadow')` here would disable the alarm under
  //               exactly the condition that should trigger it. Adoption
  //               assertion A7 asserts this registration with mode `off`; a
  //               guard around this line is what that assertion fails on.

  // Daily 03:15 IST — dual retention ceiling: 30d lastSeenAt / 180d createdAt.
  cron.schedule('15 3 * * *', () => void runShadowRetentionJob(), {
    timezone: 'Asia/Kolkata',
  })

  // Every 15 min — the positive control. A `canary` row means detection still
  // works; its absence for 45 min is what the watchdog pages on (AC-18).
  cron.schedule('*/15 * * * *', () => void runShadowCanaryJob(), {
    timezone: 'Asia/Kolkata',
  })

  // Every 10 min, unconditionally (SR-1). Predicate is over durable stat rows,
  // never over a live env read — see the file header.
  cron.schedule('*/10 * * * *', () => void runShadowWatchdogJob(), {
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
      'shadow-retention @ 03:15 IST',
      'shadow-canary @ */15 IST',
      'shadow-watchdog @ */10 IST (unconditional — SR-1)',
    ],
  })
}

// Re-exported for back-compat with test / job imports.
export { runBatchExpiryAlertsJob, runRecurringRunsCleanup, runExpenseRecurringGenerator }
export { runRecurringGenerator, runPtpEvaluator } from './cron-runners.js'
