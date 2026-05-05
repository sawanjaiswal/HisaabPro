/**
 * Manual CLI entry for the PTP evaluator — useful for testing and backfills.
 *
 * Usage:
 *   npx ts-node src/jobs/run-ptp-evaluator.ts
 *   node dist/jobs/run-ptp-evaluator.js
 */

import 'dotenv/config'
import { runPtpEvaluator } from '../lib/cron-scheduler.js'
import logger from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'

;(async () => {
  logger.info('run-ptp-evaluator.manual_start')
  try {
    await runPtpEvaluator()
    logger.info('run-ptp-evaluator.manual_complete')
  } catch (e) {
    logger.error('run-ptp-evaluator.fatal', {
      error: e instanceof Error ? e.message : String(e),
    })
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
})()
