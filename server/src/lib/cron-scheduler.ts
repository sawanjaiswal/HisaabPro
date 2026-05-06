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

  logger.info('cron.registered', { jobs: ['ptp-evaluator @ 01:00 IST'] })
}

/**
 * Exported so tests / manual CLI can call it directly.
 */
export async function runPtpEvaluator(): Promise<void> {
  logger.info('ptp-evaluator.start')
  const asOf = new Date()

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
    }

    cursor = businesses[businesses.length - 1].id
    if (businesses.length < PAGE) break
  }

  logger.info('ptp-evaluator.complete')
}
