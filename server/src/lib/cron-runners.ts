/**
 * Cron runner implementations — the job BODIES, split from the scheduler that
 * registers them (`cron-scheduler.ts`). Registration (cron expressions, tz) and
 * execution (queries, per-business isolation) are separate concerns; keeping the
 * bodies here lets tests / manual CLI import a runner without pulling in the
 * whole schedule.
 */

import os from 'os'
import { prisma } from './prisma.js'
import logger from './logger.js'
import { evaluateOpenPtps } from '../services/collections/promise-to-pay-eval.service.js'
import { runRecurringTick } from '../services/recurring/recurring-runner.service.js'
import { notifyPtpDueToday } from '../services/notifications/notification-hooks.js'

/** Stable worker id used for cron claim ownership. */
export function makeWorkerId(): string {
  return `${os.hostname()}:${process.pid}`
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
