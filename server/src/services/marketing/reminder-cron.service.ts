/**
 * Reminder Cron Service — 30-min tick (PR5)
 * Materialises ReminderInstance rows + dispatches due ones.
 * Atomic claim: updateMany WHERE status='PENDING' to avoid duplicate dispatch.
 * Zero req.* references — pure service.
 * Feature flag: REMINDER_CRON_DISABLED=1 short-circuits.
 */

import { prisma } from '../../lib/prisma.js'
import { notificationManager } from '../notifications/notification-manager.js'
import { candidatesFor, normaliseToUtcMidnight } from './reminder-trigger.service.js'
import { filterPartyIds } from './campaign-segment.service.js'
import { dropOptedOut, applyQuietHours } from './marketing-compliance.service.js'
import logger from '../../lib/logger.js'
import { Sentry } from '../../lib/sentry.js'
import type { SegmentFilter } from './campaign-segment.types.js'

const DISPATCH_BATCH = 200

export interface TickReport {
  rules: number
  materialised: number
  dispatched: number
  skipped: number
}

export async function runReminderTick(now = new Date()): Promise<TickReport> {
  if (process.env.REMINDER_CRON_DISABLED === '1') {
    logger.debug('reminder.cron.disabled')
    return { rules: 0, materialised: 0, dispatched: 0, skipped: 0 }
  }

  const report: TickReport = { rules: 0, materialised: 0, dispatched: 0, skipped: 0 }

  const rules = await prisma.reminderRule.findMany({
    where: { enabled: true, isDeleted: false },
    include: {
      template: true,
      business: {
        select: {
          id: true,
          reminderConfig: true,
          businessType: true,
        },
      },
    },
  })

  for (const rule of rules) {
    report.rules++
    try {
      // 1. Compute candidates for next 24h
      const candidates = await candidatesFor(rule, now)
      if (candidates.length === 0) continue

      // 2. Apply segmentFilter
      const allPartyIds = candidates.map((c) => c.partyId)
      const filteredSet = await filterPartyIds(
        rule.businessId,
        rule.segmentFilter as SegmentFilter,
        allPartyIds,
      )

      // 3. Drop opted-out
      const eligible = await dropOptedOut([...filteredSet])

      // 4. Build rows for bulk insert
      const rows = candidates
        .filter((c) => eligible.has(c.partyId))
        .map((c) => ({
          ruleId: rule.id,
          partyId: c.partyId,
          fireDate: normaliseToUtcMidnight(c.fireDate),
          scheduledAt: applyQuietHours(
            c.fireDate,
            rule.quietHoursStart,
            rule.quietHoursEnd,
            rule.business.reminderConfig,
          ),
          status: 'PENDING' as const,
          updatedAt: new Date(),
        }))

      if (rows.length === 0) continue

      // 5. Bulk insert — unique constraint silently drops duplicates
      const inserted = await prisma.reminderInstance.createMany({
        data: rows,
        skipDuplicates: true,
      })
      report.materialised += inserted.count

      // 6. Dispatch due instances (atomic claim)
      const due = await prisma.reminderInstance.findMany({
        where: { ruleId: rule.id, status: 'PENDING', scheduledAt: { lte: now } },
        take: DISPATCH_BATCH,
      })

      for (const inst of due) {
        // Atomic claim — only one worker wins
        const claimed = await prisma.reminderInstance.updateMany({
          where: { id: inst.id, status: 'PENDING' },
          data: { status: 'DISPATCHED', dispatchedAt: new Date(), updatedAt: new Date() },
        })
        if (claimed.count !== 1) continue // lost the race

        const eventKey = rule.trigger === 'BIRTHDAY'
          ? 'REMINDER_BIRTHDAY'
          : rule.trigger === 'PAYMENT_DUE'
            ? 'REMINDER_PAYMENT_DUE'
            : rule.trigger === 'PAYMENT_OVERDUE'
              ? 'REMINDER_PAYMENT_OVERDUE_AUTO'
              : rule.trigger === 'FOLLOWUP'
                ? 'REMINDER_FOLLOWUP'
                : rule.trigger === 'APPOINTMENT_UPCOMING'
                  ? 'REMINDER_APPOINTMENT_UPCOMING'
                  : 'REMINDER_INACTIVE'

        try {
          await notificationManager.notify(eventKey as Parameters<typeof notificationManager.notify>[0], {
            businessId: rule.businessId,
            userId: inst.partyId,
            eventKey,
            locale: 'en',
            vars: { ruleId: rule.id, instanceId: inst.id },
            entityType: 'reminder_instance',
            entityId: inst.id,
          })
          report.dispatched++

          // Architect doc §12.1 — Sentry analytics event for appointment reminders
          if (rule.trigger === 'APPOINTMENT_UPCOMING') {
            Sentry.captureMessage('appointment_reminder_sent', {
              level: 'info',
              extra: {
                businessId: rule.businessId,
                ruleId: rule.id,
                partyId: inst.partyId,
                channel: rule.channel,
                leadHours: rule.offsetDays * 24,
                vertical: rule.business.businessType,
              },
            })
          }
        } catch (err) {
          await prisma.reminderInstance.update({
            where: { id: inst.id },
            data: { status: 'FAILED', updatedAt: new Date() },
          })
          logger.error('reminder.cron.dispatch_error', { instanceId: inst.id, error: String(err) })
          report.skipped++
        }
      }
    } catch (err) {
      logger.error('reminder.cron.rule_error', { ruleId: rule.id, error: String(err) })
    }
  }

  logger.info('reminder.cron.tick_done', report)
  return report
}
