/**
 * Cron job runner wrappers — extracted from cron-scheduler.ts to keep
 * that file ≤250L. Each wrapper logs start / done / fatal and never
 * throws (cron tick must not abort sibling jobs).
 */

import logger from './logger.js'
import { deleteRunsOlderThan } from '../services/recurring/runs.js'
import { runBatchExpiryAlerts } from '../services/stock/batch-expiry-alerts.service.js'
import { generateRecurringExpenses } from '../services/expense/expense-recurring.cron.js'

export async function runBatchExpiryAlertsJob(): Promise<void> {
  logger.info('batch-expiry-alerts.start')
  try {
    const result = await runBatchExpiryAlerts()
    logger.info('batch-expiry-alerts.done', result)
  } catch (e) {
    logger.error('batch-expiry-alerts.fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export async function runRecurringRunsCleanup(): Promise<void> {
  logger.info('recurring-runs-cleanup.start')
  try {
    const deleted = await deleteRunsOlderThan(90)
    logger.info('recurring-runs-cleanup.complete', { deleted })
  } catch (e) {
    logger.error('recurring-runs-cleanup.error', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export async function runExpenseRecurringGenerator(now?: Date): Promise<void> {
  logger.info('expense-recurring-generator.cron_fire')
  try {
    const summary = await generateRecurringExpenses(now)
    logger.info('expense-recurring-generator.cron_done', summary)
  } catch (e) {
    logger.error('expense-recurring-generator.cron_fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
