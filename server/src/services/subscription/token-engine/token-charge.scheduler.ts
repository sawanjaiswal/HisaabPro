/**
 * Hourly charge scheduler for recurring token billing.
 */

import cron from 'node-cron'
import { prisma } from '../../../lib/prisma.js'
import logger from '../../../lib/logger.js'
import { FEATURES } from '../../../config/features.js'
import {
  CHARGE_BATCH_CAP,
  CHARGE_WINDOW_MS,
  MAX_ATTEMPTS,
} from './token-engine.constants.js'
import { attemptCallAt, cycleKeyFor } from './token-charge.ladder.js'
import { runTokenAttemptResolution } from './token-attempt.resolver.js'
import { executeAttempt, reserveAttempt } from './token-charge.service.js'

export async function isChargingHalted(): Promise<boolean> {
  return !FEATURES.TOKEN_BILLING.enabled
}

export async function runTokenBillingChargeTick(): Promise<void> {
  try {
    await runTokenAttemptResolution()
  } catch (e) {
    logger.error('token-billing resolver phase failed', {
      err: e instanceof Error ? e.message : String(e),
    })
  }

  if (await isChargingHalted()) {
    logger.info('token-billing charge tick: halted, skipping charge phase')
    return
  }

  const windowEnd = new Date(Date.now() + CHARGE_WINDOW_MS)
  const due = await prisma.subscription.findMany({
    where: {
      mandateId: { not: null },
      status: 'ACTIVE',
      nextBillingAt: { lte: windowEnd },
    },
    include: {
      upiMandates: {
        where: { status: 'ACTIVE', razorpayTokenId: { not: null } },
        take: 1,
      },
    },
    orderBy: { nextBillingAt: 'asc' },
    take: CHARGE_BATCH_CAP,
  })

  for (const sub of due) {
    const mandate = sub.upiMandates[0]
    if (!mandate || !sub.nextBillingAt) continue

    const cycleKey = cycleKeyFor(sub.nextBillingAt)
    const existingAttempt = await prisma.tokenChargeAttempt.findFirst({
      where: { subscriptionId: sub.id, cycleKey },
      orderBy: { attemptNo: 'desc' },
    })

    let attemptNo = 1
    if (existingAttempt) {
      if (existingAttempt.status === 'CAPTURED' || existingAttempt.status === 'CALLED') {
        continue
      }
      if (existingAttempt.attemptNo >= MAX_ATTEMPTS) {
        continue
      }
      attemptNo = existingAttempt.attemptNo + 1
    }

    const businessUser = await prisma.businessUser.findFirst({
      where: { businessId: sub.businessId, role: 'OWNER' },
      select: { userId: true },
    })
    const userId = mandate.userId || businessUser?.userId || 'system'

    const pricePaise = mandate.maxAmountPaise ? Math.floor(mandate.maxAmountPaise / 3) : 49900

    const reserved = await reserveAttempt({
      businessId: sub.businessId,
      userId,
      subscriptionId: sub.id,
      mandateId: mandate.id,
      cycleKey,
      attemptNo,
      amountPaise: pricePaise,
      chargeAt: attemptCallAt(sub.nextBillingAt, attemptNo),
    })

    if (reserved) {
      try {
        await executeAttempt(reserved)
      } catch (err) {
        logger.error('token-billing executeAttempt failed', {
          attemptId: reserved.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }
}

export function initializeTokenBillingScheduler(): void {
  // Run hourly tick
  cron.schedule('0 * * * *', () => {
    void runTokenBillingChargeTick()
  })
  logger.info('Token billing hourly scheduler initialized')
}
