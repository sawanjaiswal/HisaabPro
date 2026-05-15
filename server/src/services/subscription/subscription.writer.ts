/**
 * Subscription Writer — SSOT for ALL Subscription state mutations.
 *
 * SECURITY P1-D: enforce.js bans prisma.subscription.update/upsert/create
 * outside this file (allowlist: subscription.writer*.ts).
 *
 * SECURITY P2-B: Uses 64-bit pg_advisory_xact_lock per businessId.
 * SECURITY P2-F: Side-effects fire AFTER $transaction commits.
 * SECURITY 1.9: SubscriptionEvent.razorpayEventId @unique — P2002 on dupe = idempotent.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { transitionState } from './subscription-state-machine.js'
import {
  buildEventInsertData,
  buildSideEffects,
  gracePeriodEndsAt,
} from './subscription.writer.events.js'
import type { ApplyEventInput } from './subscription.types.js'
import { InvalidTransitionError } from './subscription.types.js'

// ─── Advisory lock helper ─────────────────────────────────────────────────────

async function acquireAdvisoryLock(tx: typeof prisma, businessId: string): Promise<void> {
  // SECURITY P2-B: 64-bit hashtextextended avoids 32-bit collision risk
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
    `subscription:${businessId}`,
  )
}

// ─── Main writer ──────────────────────────────────────────────────────────────

/**
 * Apply a subscription state event through the state machine.
 * Wraps everything in a single $transaction with advisory lock.
 * Side-effects execute AFTER the transaction commits.
 *
 * @throws InvalidTransitionError (409) if transition not valid
 * @throws Prisma P2002 if razorpayEventId already seen (caller returns 200 idempotent)
 */
export async function applySubscriptionEvent(input: ApplyEventInput): Promise<void> {
  const { businessId, subscriptionId, trigger } = input

  const sideEffectFns = await prisma.$transaction(async (tx) => {
    // 1. Acquire advisory lock (serializes concurrent webhooks per business)
    await acquireAdvisoryLock(tx as typeof prisma, businessId)

    // 2. Fetch current subscription (tenant-scoped — both businessId + id)
    const sub = await tx.subscription.findFirst({
      where: { id: subscriptionId, businessId },
      select: {
        id: true,
        subscriptionState: true,
        gracePeriodEndsAt: true,
      },
    })

    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found for business ${businessId}`)
    }

    const fromState = sub.subscriptionState as string | null

    // 3. Validate state transition (throws 409 if invalid)
    const result = transitionState(
      fromState as Parameters<typeof transitionState>[0],
      trigger,
    )

    // 4. Compute DB mutation fields
    const updateFields: Record<string, unknown> = {
      subscriptionState: result.toState,
      updatedAt: new Date(),
    }

    if (result.sideEffects.includes('set_grace')) {
      updateFields.gracePeriodEndsAt = gracePeriodEndsAt()
    }
    if (result.sideEffects.includes('clear_grace')) {
      updateFields.gracePeriodEndsAt = null
    }
    if (input.planTier) {
      updateFields.planTier = input.planTier
    }
    if (trigger === 'user.cancel') {
      updateFields.cancelledAt = new Date()
    }

    // 5. Update subscription row (tenant-scoped)
    await tx.subscription.update({
      where: { id: subscriptionId, businessId },
      data: updateFields as Parameters<typeof tx.subscription.update>[0]['data'],
    })

    // 6. Insert immutable SubscriptionEvent (idempotency via unique razorpayEventId)
    const eventData = buildEventInsertData(input, fromState, result)
    await tx.subscriptionEvent.create({ data: eventData })

    logger.info('subscription.state_transition', {
      businessId,
      subscriptionId,
      fromState,
      toState: result.toState,
      trigger,
      actorType: input.actorType,
    })

    // 7. Return side-effect closures (executed AFTER commit — P2-F)
    return buildSideEffects(result.sideEffects, {
      businessId,
      subscriptionId,
      toState: result.toState,
    })
  })

  // 8. Fire side-effects OUTSIDE the transaction
  for (const fn of sideEffectFns) {
    try {
      await fn()
    } catch (e) {
      logger.error('subscription.side_effect_error', {
        error: e instanceof Error ? e.message : String(e),
        businessId,
      })
    }
  }
}

export { InvalidTransitionError }
