/**
 * Notification Engine — Retention Purge (PR10)
 *
 * runRetentionPurge(): batched DELETEs with 50% sanity guard + audit logging.
 * Called by the 02:00 IST Sunday cron job.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

const NOTIFICATION_RETAIN_DAYS = 90
const JOB_RETAIN_DAYS = 30
const BATCH_SIZE = 5000
const SANITY_GUARD_PCT = 0.5

async function purgeTable(
  label: string,
  countFn: () => Promise<number>,
  batchDeleteFn: (cutoff: Date) => Promise<number>,
  cutoff: Date,
): Promise<number> {
  const total = await countFn()
  if (total === 0) {
    logger.info(`notification.retention.${label}.empty`)
    return 0
  }

  let deleted = 0

  while (true) {
    const batch = await batchDeleteFn(cutoff)
    if (batch === 0) break

    // 50% sanity guard per batch
    if (batch > total * SANITY_GUARD_PCT) {
      logger.error(`notification.retention.${label}.sanity_abort`, {
        batch,
        total,
        pct: (batch / total).toFixed(2),
      })
      break
    }

    deleted += batch
    logger.info(`notification.retention.${label}.batch`, { batch, totalDeleted: deleted })

    if (batch < BATCH_SIZE) break
  }

  return deleted
}

export async function runRetentionPurge(): Promise<{ notifications: number; jobs: number }> {
  logger.info('notification.retention.start')

  const notifCutoff = new Date(Date.now() - NOTIFICATION_RETAIN_DAYS * 86_400_000)
  const jobCutoff = new Date(Date.now() - JOB_RETAIN_DAYS * 86_400_000)

  const notifications = await purgeTable(
    'notification',
    () => prisma.notification.count({ where: { createdAt: { lt: notifCutoff } } }),
    async (cutoff) => {
      const ids = await prisma.notification.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      })
      if (ids.length === 0) return 0
      const { count } = await prisma.notification.deleteMany({
        where: { id: { in: ids.map((r) => r.id) } },
      })
      return count
    },
    notifCutoff,
  )

  const jobs = await purgeTable(
    'notificationjob',
    () =>
      prisma.notificationJob.count({
        where: {
          status: { in: ['DISPATCHED', 'DEAD', 'FAILED'] },
          createdAt: { lt: jobCutoff },
        },
      }),
    async (cutoff) => {
      const ids = await prisma.notificationJob.findMany({
        where: {
          status: { in: ['DISPATCHED', 'DEAD', 'FAILED'] },
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      })
      if (ids.length === 0) return 0
      const { count } = await prisma.notificationJob.deleteMany({
        where: { id: { in: ids.map((r) => r.id) } },
      })
      return count
    },
    jobCutoff,
  )

  logger.info('notification.retention.complete', { notifications, jobs })
  return { notifications, jobs }
}
