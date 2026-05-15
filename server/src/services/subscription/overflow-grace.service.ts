/**
 * Overflow Grace Service — records quota overflow and manages grace periods.
 *
 * When a business exceeds their monthly quota (invoices/users), a grace
 * period is set (default 3 days). After grace expires, cron flips isEnforced.
 * Middleware reads overflowGraceUntil to allow/deny creation.
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const OVERFLOW_GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_OVERFLOW_GRACE_DAYS ?? '3', 10)

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Record overflow for a business — sets overflowGraceUntil to now + grace days.
 * Idempotent: if already in grace, no-op.
 */
export async function recordOverflow(businessId: string): Promise<{ graceUntil: Date }> {
  const now = new Date()
  const graceUntil = new Date(now)
  graceUntil.setDate(graceUntil.getDate() + OVERFLOW_GRACE_DAYS)

  // Tenant-scoped update
  await prisma.subscription.updateMany({
    where: {
      businessId,
      OR: [
        { overflowGraceUntil: null },
        { overflowGraceUntil: { lt: now } },
      ],
    },
    data: { overflowGraceUntil: graceUntil },
  })

  logger.info('subscription.overflow_recorded', {
    businessId,
    graceUntil: graceUntil.toISOString(),
    graceDays: OVERFLOW_GRACE_DAYS,
  })

  return { graceUntil }
}

/**
 * Check if a business is currently in overflow grace.
 * Returns true = still in grace (allow resource creation).
 * Returns false = grace expired or never set.
 */
export async function checkOverflowGrace(businessId: string): Promise<{
  isGrace: boolean
  graceUntil: Date | null
}> {
  const sub = await prisma.subscription.findUnique({
    where: { businessId },
    select: { overflowGraceUntil: true },
  })

  const graceUntil = sub?.overflowGraceUntil ?? null
  const isGrace = graceUntil !== null && graceUntil > new Date()

  return { isGrace, graceUntil }
}

/**
 * Clear overflow grace — used when business upgrades.
 */
export async function clearOverflowGrace(businessId: string): Promise<void> {
  await prisma.subscription.updateMany({
    where: { businessId },
    data: { overflowGraceUntil: null },
  })

  logger.info('subscription.overflow_cleared', { businessId })
}

/**
 * Enforce overflow: mark businesses past their grace period.
 * Called by cron at 06:00 IST.
 * Returns count of businesses where grace just expired.
 */
export async function enforceExpiredOverflow(): Promise<{ count: number }> {
  const now = new Date()

  // Find businesses with expired overflow grace (cursor-paged, max 500)
  const expired = await prisma.subscription.findMany({
    where: {
      overflowGraceUntil: { lt: now, not: null },
    },
    select: { businessId: true, id: true },
    take: 500,
    orderBy: { businessId: 'asc' },
  })

  if (expired.length === 0) return { count: 0 }

  // Clear grace (enforcement is via middleware checking overflowGraceUntil < now)
  await prisma.subscription.updateMany({
    where: {
      businessId: { in: expired.map((e) => e.businessId) },
    },
    data: { overflowGraceUntil: null },
  })

  logger.info('subscription.overflow_enforced', { count: expired.length })

  return { count: expired.length }
}
