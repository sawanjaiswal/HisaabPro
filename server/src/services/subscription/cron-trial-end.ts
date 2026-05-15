/**
 * Cron: Trial End — runs daily at 07:00 IST.
 * Sweeps TRIAL_NO_AUTOPAY subscriptions with trialEndsAt < now.
 * Triggers day31.reached.no_mandate → PAST_DUE (sets 7-day grace).
 *
 * Bounded: cursor loop, take: 500.
 * Idempotent: safe to re-run same day.
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import { applySubscriptionEvent } from './subscription.writer.js'
import { InvalidTransitionError } from './subscription.types.js'

const PAGE_SIZE = 500

export async function runTrialEndJob(): Promise<{ transitioned: number }> {
  const now = new Date()
  let transitioned = 0
  let cursor: string | undefined

  logger.info('cron.trial_end.start', { now: now.toISOString() })

  while (true) {
    const batch = await prisma.subscription.findMany({
      where: {
        subscriptionState: 'TRIAL_NO_AUTOPAY',
        trialEndsAt: { lt: now, not: null },
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
          trigger: 'day31.reached.no_mandate',
          actorType: 'CRON',
        })
        transitioned++
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          logger.debug('cron.trial_end.already_transitioned', {
            subscriptionId: sub.id,
            businessId: sub.businessId,
          })
        } else {
          logger.error('cron.trial_end.error', {
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

  logger.info('cron.trial_end.complete', { transitioned })

  return { transitioned }
}
