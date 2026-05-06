/**
 * Manual CLI entry for the recurring invoice generator — useful for testing and backfills.
 *
 * Usage:
 *   npx ts-node src/jobs/run-recurring-generator.ts
 *   node dist/jobs/run-recurring-generator.js
 */

import 'dotenv/config'
import { runRecurringGenerator } from '../lib/cron-scheduler.js'
import logger from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'

;(async () => {
  logger.info('run-recurring-generator.manual_start')
  try {
    await runRecurringGenerator()
    logger.info('run-recurring-generator.manual_complete')
  } catch (e) {
    logger.error('run-recurring-generator.fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
})()
