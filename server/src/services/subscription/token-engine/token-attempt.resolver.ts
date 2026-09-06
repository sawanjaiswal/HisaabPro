/**
 * Stale-attempt resolver + pending-mandate sweep.
 */

import { prisma } from '../../../lib/prisma.js'
import logger from '../../../lib/logger.js'
import {
  fetchCustomerTokens,
  fetchOrdersByReceipt,
} from './razorpay-token.client.js'
import {
  PENDING_MANDATE_SWEEP_MS,
  POISON_ATTEMPT_TTL_MS,
} from './token-engine.constants.js'
import { bindConfirmedToken } from './token-mandate.service.js'
import { expireStalePendingMandate } from './token-mandate.lifecycle.js'
import {
  settleCapturedAttempt,
  settleFailedAttempt,
} from './token-webhook.handlers.js'
import { activateFromMandate } from './token-mandate.activate.js'

const RESOLVER_BATCH = 25

export async function runTokenAttemptResolution(): Promise<void> {
  await settlePoisonScheduled()
  await sweepPendingMandates()
}

async function settlePoisonScheduled(): Promise<void> {
  const cutoff = new Date(Date.now() - POISON_ATTEMPT_TTL_MS)
  const poison = await prisma.tokenChargeAttempt.findMany({
    where: { status: 'SCHEDULED', createdAt: { lt: cutoff } },
    take: RESOLVER_BATCH,
  })

  for (const attempt of poison) {
    try {
      const { items } = await fetchOrdersByReceipt(attempt.receiptKey)
      const orders = items ?? []

      if (orders.length === 0) {
        await settleFailedAttempt(attempt, 'poison_no_provider_order')
      } else {
        const paid = orders.find((o) => o.status === 'paid')
        if (paid) {
          await settleCapturedAttempt(attempt)
        } else {
          await settleFailedAttempt(attempt, 'poison_order_unpaid')
        }
      }
    } catch (e) {
      logger.warn('Poison-attempt settlement read failed — retrying next tick', {
        attemptId: attempt.id,
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }
}

export async function sweepPendingMandates(): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_MANDATE_SWEEP_MS)
  const pending = await prisma.upiMandate.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff }, razorpayTokenId: null },
    take: RESOLVER_BATCH,
  })

  for (const mandate of pending) {
    if (!mandate.razorpayCustomerId) {
      await expireStalePendingMandate(mandate.id)
      continue
    }

    try {
      const { items } = await fetchCustomerTokens(mandate.razorpayCustomerId)
      const tokens = items ?? []
      const confirmed = tokens.find((t) => t.recurring_details?.status === 'confirmed' || t.status === 'confirmed')

      if (confirmed) {
        const { bound } = await bindConfirmedToken(mandate.id, mandate.businessId, confirmed)
        if (bound) {
          await activateFromMandate(mandate.id)
        }
      } else {
        await expireStalePendingMandate(mandate.id)
      }
    } catch (e) {
      logger.warn('Pending-mandate sweep customer lookup failed — retiring row', {
        mandateId: mandate.id,
        err: e instanceof Error ? e.message : String(e),
      })
      await expireStalePendingMandate(mandate.id)
    }
  }
}
