/** Notification Engine — Cron Integrations (PR10) */

import cron from 'node-cron'
import os from 'os'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { claimBatch, reclaimStale } from './notification-queue.service.js'
import { processJob } from './notification-dispatch-processor.service.js'
import { notify } from './notification-dispatch.service.js'
import { runRetentionPurge } from './notification-retention.service.js'
import { runReminderTick } from '../marketing/reminder-cron.service.js'
import { runMarketingRetentionPurge } from '../marketing/marketing-retention.service.js'

// Advisory lock constant — stable across deploys
const DRAIN_LOCK_KEY = 8_675_309

function makeWorkerId(): string {
  return `${os.hostname()}:${process.pid}`
}

// 1. Drain queue — every 1 minute
export async function runDrainTick(): Promise<{ claimed: number }> {
  const workerId = makeWorkerId()

  // Acquire pg advisory lock — skip tick if another worker holds it
  const [lockRow] = await prisma.$queryRaw<[{ acquired: boolean }]>`
    SELECT pg_try_advisory_lock(${DRAIN_LOCK_KEY}::bigint) AS acquired
  `

  if (!lockRow?.acquired) {
    logger.debug('notification.drain.lock_skipped', { workerId })
    return { claimed: 0 }
  }

  try {
    const stale = await reclaimStale(5)
    if (stale > 0) {
      logger.warn('notification.drain.reclaimed_stale', { count: stale, workerId })
    }

    const jobs = await claimBatch(workerId, 50)
    logger.debug('notification.drain.claimed', { count: jobs.length, workerId })

    await Promise.allSettled(jobs.map((job) => processJob(job)))

    return { claimed: jobs.length }
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${DRAIN_LOCK_KEY}::bigint)`
  }
}

// 2. 08:00 IST daily — overdue invoice scan
export async function runOverdueScan(): Promise<void> {
  logger.info('notification.overdue_scan.start')
  const now = new Date()

  // Cursor-paginated to avoid loading all overdue docs into memory
  let cursor: string | undefined
  const PAGE = 100
  let emitted = 0

  while (true) {
    const docs = await prisma.document.findMany({
      where: {
        type: 'SALE_INVOICE',
        status: { in: ['SAVED', 'SHARED'] },
        isDeleted: false,
        dueDate: { lt: now },
        balanceDue: { gt: 0 },
      },
      select: {
        id: true,
        businessId: true,
        createdBy: true,
        documentNumber: true,
        balanceDue: true,
        dueDate: true,
      },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (docs.length === 0) break

    for (const doc of docs) {
      try {
        await notify('PAYMENT_OVERDUE', {
          businessId: doc.businessId,
          userId: doc.createdBy,
          eventKey: 'PAYMENT_OVERDUE',
          locale: 'en',
          vars: {
            invoiceNo: doc.documentNumber ?? '',
            amount: String(doc.balanceDue),
            dueDate: doc.dueDate?.toISOString().slice(0, 10) ?? '',
          },
          entityType: 'invoice',
          entityId: doc.id,
        })
        emitted++
      } catch (err) {
        logger.error('notification.overdue_scan.emit_error', {
          docId: doc.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    cursor = docs[docs.length - 1]?.id
    if (docs.length < PAGE) break
  }

  logger.info('notification.overdue_scan.complete', { emitted })
}

// 3. 09:00 IST daily — subscription expiry scan
export async function runSubscriptionExpiryScan(): Promise<void> {
  logger.info('notification.subscription_expiry_scan.start')
  const now = new Date()
  const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000)
  let emitted = 0

  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      expiresAt: { gt: now, lt: sevenDaysOut },
    },
    select: { businessId: true, expiresAt: true },
  })

  for (const sub of subs) {
    try {
      // Notify all active owners of the business
      const owners = await prisma.businessUser.findMany({
        where: { businessId: sub.businessId, isActive: true, role: 'owner' },
        select: { userId: true },
      })

      for (const owner of owners) {
        await notify('SUBSCRIPTION_EXPIRING_SOON', {
          businessId: sub.businessId,
          userId: owner.userId,
          eventKey: 'SUBSCRIPTION_EXPIRING_SOON',
          locale: 'en',
          vars: {
            expiresAt: sub.expiresAt?.toISOString().slice(0, 10) ?? '',
          },
        })
        emitted++
      }
    } catch (err) {
      logger.error('notification.subscription_expiry_scan.emit_error', {
        businessId: sub.businessId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('notification.subscription_expiry_scan.complete', { emitted, businesses: subs.length })
}

// 4. 02:00 IST Sunday — retention purge
export async function runRetentionPurgeCron(): Promise<void> {
  logger.info('notification.retention_purge.cron_fire')
  try {
    const result = await runRetentionPurge()
    logger.info('notification.retention_purge.cron_done', result)
  } catch (err) {
    logger.error('notification.retention_purge.cron_fatal', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// 5. 00:05 IST 1st of month — cost-month roll log
export async function runMonthRoll(): Promise<void> {
  const ym = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  logger.info('notification.month_roll', { month: ym })
  // NotificationCostTally rows are keyed by (businessId, channel, yearMonth).
  // New rows are auto-created on first cap check for the new month — no-op here.
}

// initNotificationCronJobs — called from cron-scheduler.ts initCronJobs()
export function initNotificationCronJobs(): void {
  // 1. Drain queue — every 1 minute
  cron.schedule(
    '* * * * *',
    () => void runDrainTick(),
    { timezone: 'Asia/Kolkata' },
  )

  // 2. 08:00 IST daily — overdue invoice scan
  cron.schedule(
    '0 8 * * *',
    () => void runOverdueScan(),
    { timezone: 'Asia/Kolkata' },
  )

  // 3. 09:00 IST daily — subscription expiry scan
  cron.schedule(
    '0 9 * * *',
    () => void runSubscriptionExpiryScan(),
    { timezone: 'Asia/Kolkata' },
  )

  // 4. 02:00 IST every Sunday — retention purge
  cron.schedule(
    '0 2 * * 0',
    () => void runRetentionPurgeCron(),
    { timezone: 'Asia/Kolkata' },
  )

  // 5. 00:05 IST on the 1st of every month — cost-month roll
  cron.schedule(
    '5 0 1 * *',
    () => void runMonthRoll(),
    { timezone: 'Asia/Kolkata' },
  )

  // 6. Every 30 min — reminder rule tick (Phase 5)
  cron.schedule(
    '*/30 * * * *',
    () => void runReminderTick(),
    { timezone: 'Asia/Kolkata' },
  )

  // 7. 03:00 IST daily — marketing PII retention purge (Phase 5)
  cron.schedule('0 3 * * *', () => {
    void runMarketingRetentionPurge()
      .then((r) => logger.info('marketing.retention.cron_done', r))
      .catch((err) => logger.error('marketing.retention.cron_fatal', { error: String(err) }))
  }, { timezone: 'Asia/Kolkata' })

  logger.info('notification.cron.registered', {
    jobs: [
      'notification-drain @ */1 IST',
      'overdue-scan @ 08:00 IST',
      'subscription-expiry-scan @ 09:00 IST',
      'retention-purge @ 02:00 IST Sunday',
      'month-roll @ 00:05 IST 1st-of-month',
      'reminder-tick @ */30 IST',
      'marketing-retention-purge @ 03:00 IST daily',
    ],
  })
}
