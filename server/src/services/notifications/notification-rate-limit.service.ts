/**
 * Notification Engine — Rate Limit Service (PR6)
 *
 * Per-user, per-day external-channel cap of 10 notifications.
 * IN_APP channel is explicitly excluded.
 *
 * Uses a DB count query scoped to the IST calendar day — atomic and
 * multi-instance safe (no in-memory state that can diverge).
 *
 * Counted statuses: QUEUED, PROCESSING, DISPATCHED, DELIVERED
 * (excludes FAILED/DEAD so transient failures don't burn quota).
 */

import type { NotificationChannel } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DAILY_EXTERNAL_CAP = 10

// ---------------------------------------------------------------------------
// IST day boundaries
// ---------------------------------------------------------------------------

function istDayStart(): Date {
  const now = new Date()
  // Format current IST date as YYYY-MM-DD then parse back as UTC midnight equivalent
  const istDateStr = now.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }) // "YYYY-MM-DD"

  // IST is UTC+5:30, so midnight IST = 18:30 UTC previous day
  // Use toLocaleString to find the UTC time for IST midnight
  const istMidnightUTC = new Date(`${istDateStr}T00:00:00+05:30`)
  return istMidnightUTC
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean
  count: number
  capacity: number
}

// ---------------------------------------------------------------------------
// Check rate limit
// ---------------------------------------------------------------------------

/**
 * Returns whether the user is under their daily external notification cap.
 * IN_APP channel always returns allowed=true.
 */
export async function checkRateLimit(
  userId: string,
  channel: NotificationChannel,
): Promise<RateLimitResult> {
  if (channel === 'IN_APP') {
    return { allowed: true, count: 0, capacity: DAILY_EXTERNAL_CAP }
  }

  const dayStart = istDayStart()

  const count = Number(
    await prisma.notificationJob.count({
      where: {
        userId,
        channel: { not: 'IN_APP' },
        status: { in: ['QUEUED', 'PROCESSING', 'DISPATCHED', 'DELIVERED'] },
        createdAt: { gte: dayStart },
      },
    }),
  )

  const allowed = count < DAILY_EXTERNAL_CAP

  if (!allowed) {
    logger.warn('notification.rate_limit.exceeded', { userId, count, cap: DAILY_EXTERNAL_CAP })
  } else {
    logger.debug('notification.rate_limit.check', { userId, count, cap: DAILY_EXTERNAL_CAP })
  }

  return { allowed, count, capacity: DAILY_EXTERNAL_CAP }
}
