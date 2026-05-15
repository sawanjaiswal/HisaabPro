/**
 * Cron: Mandate Reminder — runs daily at 08:00 IST.
 * Finds UpiMandate rows in PENDING status older than 24h.
 * Enqueues a reminder notification — no state-machine call.
 *
 * Bounded: cursor loop, take: 500.
 * Idempotent: reminder is best-effort, no state change.
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'

const PAGE_SIZE = 500
const REMINDER_THRESHOLD_HOURS = 24

export async function runMandateReminderJob(): Promise<{ reminded: number }> {
  const cutoff = new Date(Date.now() - REMINDER_THRESHOLD_HOURS * 60 * 60 * 1000)
  let reminded = 0
  let cursor: string | undefined

  logger.info('cron.mandate_reminder.start', { cutoff: cutoff.toISOString() })

  while (true) {
    const batch = await prisma.upiMandate.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        businessId: true,
        subscriptionId: true,
        frequency: true,
        createdAt: true,
      },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (batch.length === 0) break

    for (const mandate of batch) {
      try {
        // Stub: enqueue notification via notification service
        // Future: call notificationService.enqueue('mandate_pending_24h', { businessId })
        logger.info('cron.mandate_reminder.notify_stub', {
          businessId: mandate.businessId,
          mandateId: mandate.id,
          pendingHours: Math.floor((Date.now() - mandate.createdAt.getTime()) / 3_600_000),
        })
        reminded++
      } catch (err) {
        logger.error('cron.mandate_reminder.error', {
          mandateId: mandate.id,
          businessId: mandate.businessId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    cursor = batch[batch.length - 1].id
    if (batch.length < PAGE_SIZE) break
  }

  logger.info('cron.mandate_reminder.complete', { reminded })

  return { reminded }
}
