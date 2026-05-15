/**
 * Cron: Grace Expiry — runs daily at 06:00 IST.
 * Sweeps PAST_DUE subscriptions with gracePeriodEndsAt < now.
 * Triggers grace.expired → LOCKED via state machine.
 *
 * Bounded: cursor loop, take: 500 (Render Starter 512MB RAM constraint).
 * Idempotent: safe to re-run same day.
 * Also runs overflow enforcement (piggyback per architecture).
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import { applySubscriptionEvent } from './subscription.writer.js'
import { enforceExpiredOverflow } from './overflow-grace.service.js'
import { InvalidTransitionError } from './subscription.types.js'

const PAGE_SIZE = 500

export async function runGraceExpiryJob(): Promise<{ expired: number; overflowEnforced: number }> {
  const now = new Date()
  let expired = 0
  let cursor: string | undefined

  logger.info('cron.grace_expiry.start', { now: now.toISOString() })

  // Cursor-paged sweep: PAST_DUE where grace has expired
  while (true) {
    const batch = await prisma.subscription.findMany({
      where: {
        subscriptionState: 'PAST_DUE',
        gracePeriodEndsAt: { lt: now, not: null },
      },
      select: { id: true, businessId: true },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (batch.length === 0) break

    for (const sub of batch) {
      try {
        await applySubscriptionEvent({
          businessId: sub.businessId,
          subscriptionId: sub.id,
          trigger: 'grace.expired',
          actorType: 'CRON',
        })
        expired++
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          // Already transitioned — idempotent, skip
          logger.debug('cron.grace_expiry.already_transitioned', {
            subscriptionId: sub.id,
            businessId: sub.businessId,
          })
        } else {
          logger.error('cron.grace_expiry.error', {
            subscriptionId: sub.id,
            businessId: sub.businessId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    cursor = batch[batch.length - 1].id
    if (batch.length < PAGE_SIZE) break
  }

  // Piggyback: enforce expired overflow grace
  const { count: overflowEnforced } = await enforceExpiredOverflow().catch((err) => {
    logger.error('cron.grace_expiry.overflow_enforce_error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { count: 0 }
  })

  logger.info('cron.grace_expiry.complete', { expired, overflowEnforced })

  return { expired, overflowEnforced }
}
