/**
 * Notification Engine — Cost Cap Service (PR6)
 *
 * Responsibilities:
 *   - checkCap(businessId, channel, costPaise) — atomic CAS pre-flight
 *   - recordSpend(businessId, channel, costPaise) — post-dispatch increment
 *   - 80% warning emit via in-app notification
 *
 * Plan caps (paise): free=50000, pro=200000, business=1000000
 * Month key = YYYY-MM in IST (Asia/Kolkata).
 * Atomic CAS via $executeRaw — no race conditions.
 */

import type { NotificationChannel } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLAN_CAPS_PAISE: Record<string, number> = {
  FREE: 50_000,
  PRO: 200_000,
  BUSINESS: 1_000_000,
} as const

const WARN_THRESHOLD = 0.80

// ---------------------------------------------------------------------------
// IST helpers
// ---------------------------------------------------------------------------

function currentMonthIST(): string {
  // Returns "YYYY-MM" in Asia/Kolkata
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).slice(0, 7)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostCapResult {
  allowed: boolean
  remainingPaise: number
  warn80pct: boolean
}

// ---------------------------------------------------------------------------
// Check cap — atomic CAS
// ---------------------------------------------------------------------------

/**
 * Pre-flight cost check. Uses atomic CAS to avoid over-spending.
 * IN_APP channel always returns allowed=true (no cost).
 */
export async function checkCap(
  businessId: string,
  planTier: string,
  channel: NotificationChannel,
  costPaise: number,
): Promise<CostCapResult> {
  if (channel === 'IN_APP' || costPaise === 0) {
    return { allowed: true, remainingPaise: Infinity, warn80pct: false }
  }

  const cap = PLAN_CAPS_PAISE[planTier.toUpperCase()] ?? PLAN_CAPS_PAISE['FREE']
  const month = currentMonthIST()

  // Ensure row exists before CAS
  await prisma.notificationCostTally.upsert({
    where: { businessId_month_channel: { businessId, month, channel } },
    create: { businessId, month, channel, totalPaise: 0, sentCount: 0 },
    update: {},
  })

  // Atomic CAS: only increment if cap not exceeded
  const updated = await prisma.$executeRaw`
    UPDATE "NotificationCostTally"
    SET "totalPaise" = "totalPaise" + ${costPaise}
    WHERE "businessId" = ${businessId}
      AND "month" = ${month}
      AND "channel" = ${channel}::"NotificationChannel"
      AND "totalPaise" + ${costPaise} <= ${cap}
  `

  if (updated === 0) {
    // Row was not updated — cap exceeded
    const tally = await prisma.notificationCostTally.findUnique({
      where: { businessId_month_channel: { businessId, month, channel } },
    })
    const spent = tally?.totalPaise ?? cap
    logger.warn('notification.cost.cap_exceeded', {
      businessId, channel, spent, cap, costPaise,
    })
    return { allowed: false, remainingPaise: Math.max(0, cap - spent), warn80pct: false }
  }

  // Fetch updated row to check 80% threshold
  const tally = await prisma.notificationCostTally.findUnique({
    where: { businessId_month_channel: { businessId, month, channel } },
  })
  const newTotal = tally?.totalPaise ?? costPaise
  const remaining = Math.max(0, cap - newTotal)
  const warn80pct = newTotal / cap >= WARN_THRESHOLD

  logger.debug('notification.cost.check_passed', {
    businessId, channel, newTotal, cap, remaining,
  })

  return { allowed: true, remainingPaise: remaining, warn80pct }
}

// ---------------------------------------------------------------------------
// Record spend — post-dispatch increment
// ---------------------------------------------------------------------------

/**
 * Increment tally after successful dispatch.
 * Idempotent guard: call only on QUEUED → DISPATCHED transition.
 */
export async function recordSpend(
  businessId: string,
  channel: NotificationChannel,
  costPaise: number,
): Promise<void> {
  if (costPaise === 0 || channel === 'IN_APP') return

  const month = currentMonthIST()

  await prisma.notificationCostTally.upsert({
    where: { businessId_month_channel: { businessId, month, channel } },
    create: { businessId, month, channel, totalPaise: costPaise, sentCount: 1 },
    update: {
      totalPaise: { increment: costPaise },
      sentCount: { increment: 1 },
    },
  })

  logger.debug('notification.cost.spend_recorded', { businessId, channel, costPaise, month })
}

// ---------------------------------------------------------------------------
// Resolve plan tier from Subscription
// ---------------------------------------------------------------------------

export async function getPlanTier(businessId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({
    where: { businessId },
    select: { planTier: true },
  })
  return sub?.planTier ?? 'FREE'
}
