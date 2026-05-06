/**
 * Manual CLI entrypoint for the batch-expiry-alerts cron job.
 *
 * Usage:
 *   pnpm tsx server/src/jobs/run-batch-expiry-alerts.ts
 *   node dist/jobs/run-batch-expiry-alerts.js
 *
 * Exit code is always 0 — cron survival per BAT-04 spec.
 * Errors are swallowed at job level and written to structured log.
 */

import 'dotenv/config'
import { runBatchExpiryAlerts } from '../services/stock/batch-expiry-alerts.service.js'
import logger from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'

;(async () => {
  logger.info('batch-expiry-alerts.manual_start')

  try {
    const result = await runBatchExpiryAlerts()
    logger.info('batch-expiry-alerts.manual_complete', result)

    // Also write to stdout so CLI callers see the summary
    process.stdout.write(JSON.stringify({ success: true, data: result }, null, 2) + '\n')
  } catch (err) {
    logger.error('batch-expiry-alerts.fatal', {
      error: err instanceof Error ? err.message : String(err),
    })
    // Job-level error swallowed — exit code stays 0 for cron survival
  } finally {
    await prisma.$disconnect()
  }
})()
