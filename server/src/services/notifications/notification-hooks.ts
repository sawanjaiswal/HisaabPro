/**
 * Notification Hooks — fire-and-forget wrappers for common cross-service events.
 * Callers await these but they never throw.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { notificationManager } from './notification-manager.js'
import { formatPaise } from './notification-template.service.js'
import type { EventKey } from './notification-events.js'

/** Resolve the owner userId for a business (first active owner role). */
async function resolveOwner(businessId: string): Promise<string | null> {
  const u = await prisma.businessUser.findFirst({
    where: { businessId, role: 'owner', isActive: true },
    select: { userId: true },
  })
  return u?.userId ?? null
}

/** Fire stock-level notification after an alert is created or upgraded. */
export async function notifyStockAlert(opts: {
  businessId: string
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK'
  alertId: string
  productName: string
  currentStock: number
  threshold: number
}): Promise<void> {
  const userId = await resolveOwner(opts.businessId)
  if (!userId) return

  const eventKey: EventKey = opts.alertType === 'OUT_OF_STOCK' ? 'STOCK_OUT' : 'LOW_STOCK_ALERT'
  try {
    await notificationManager.notify(eventKey, {
      businessId: opts.businessId,
      userId,
      eventKey,
      locale: 'en',
      vars: { productName: opts.productName, currentStock: opts.currentStock, threshold: opts.threshold },
      entityType: 'stock_alert',
      entityId: opts.alertId,
    })
  } catch (err) {
    logger.warn('notify.failed', { eventKey, err })
  }
}

/** Fire PTP_BROKEN for one evaluated PTP. Resolves owner internally. */
export async function notifyPtpBroken(opts: {
  businessId: string
  ptpId: string
  amountPaise: number
  promiseDate: Date
}): Promise<void> {
  const userId = await resolveOwner(opts.businessId)
  if (!userId) return

  try {
    await notificationManager.notify('PTP_BROKEN', {
      businessId: opts.businessId,
      userId,
      eventKey: 'PTP_BROKEN',
      locale: 'en',
      vars: {
        ptpId: opts.ptpId,
        amountRs: formatPaise(opts.amountPaise),
        promiseDate: opts.promiseDate.toISOString().slice(0, 10),
      },
      entityType: 'ptp',
      entityId: opts.ptpId,
    })
  } catch (err) {
    logger.warn('notify.failed', { eventKey: 'PTP_BROKEN', err })
  }
}

/** Fire PTP_DUE_TODAY for one PTP. Resolves owner internally. */
export async function notifyPtpDueToday(opts: {
  businessId: string
  ptpId: string
  amountPaise: number
  promiseDate: Date
}): Promise<void> {
  const userId = await resolveOwner(opts.businessId)
  if (!userId) return

  try {
    await notificationManager.notify('PTP_DUE_TODAY', {
      businessId: opts.businessId,
      userId,
      eventKey: 'PTP_DUE_TODAY',
      locale: 'en',
      vars: {
        ptpId: opts.ptpId,
        amountRs: formatPaise(opts.amountPaise),
        dueDate: opts.promiseDate.toISOString().slice(0, 10),
      },
      entityType: 'ptp',
      entityId: opts.ptpId,
    })
  } catch (err) {
    logger.warn('notify.failed', { eventKey: 'PTP_DUE_TODAY', err })
  }
}
