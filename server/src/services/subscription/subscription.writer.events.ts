/**
 * Writer Events — builds SubscriptionEvent insert payloads and
 * computes side-effect closures for post-transaction execution.
 *
 * SECURITY: Side-effects are RETURNED as an array of async functions.
 * The writer calls them AFTER prisma.$transaction() commits — never inside.
 * This prevents phantom notifications on rollback (architecture §4 P2-F).
 *
 * NO Prisma imports in this file (pure logic). Prisma types come from caller.
 */

import { randomUUID } from 'node:crypto'
import type { ApplyEventInput, SideEffect, StateTransitionResult } from './subscription.types.js'
import logger from '../../lib/logger.js'

// ─── Event insert payload ─────────────────────────────────────────────────────

export interface SubscriptionEventInsertData {
  id: string
  businessId: string
  subscriptionId: string
  eventType: string
  fromState: string | null
  toState: string | null
  payload: Record<string, unknown>
  razorpayEventId: string | null
  actorUserId: string | null
  actorType: string
}

// ─── Grace period defaults ────────────────────────────────────────────────────

const GRACE_PERIOD_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS ?? '7', 10)

// ─── Side-effect builders ─────────────────────────────────────────────────────

export type SideEffectFn = () => Promise<void>

/**
 * Build the SubscriptionEvent insert data from input + transition result.
 */
export function buildEventInsertData(
  input: ApplyEventInput,
  fromState: string | null,
  result: StateTransitionResult,
): SubscriptionEventInsertData {
  const eventTypeMap: Record<string, string> = {
    'payment.captured.promo': 'ACTIVATE',
    'payment.captured.full': 'ACTIVATE',
    'payment.captured.recurring': 'RENEW',
    'admin.force_activate': 'ADMIN_GRANT',
    'mandate.created': 'MANDATE_CREATE',
    'mandate.cancelled': 'MANDATE_REVOKE',
    'subscription.charged.failed': 'STATE_TRANSITION',
    'day31.reached.no_mandate': 'TRIAL_END',
    'grace.expired': 'STATE_TRANSITION',
    'user.cancel': 'CANCEL',
  }

  return {
    id: randomUUID(),
    businessId: input.businessId,
    subscriptionId: input.subscriptionId,
    eventType: eventTypeMap[input.trigger] ?? 'STATE_TRANSITION',
    fromState,
    toState: result.toState,
    payload: {
      trigger: input.trigger,
      ...(input.payload ?? {}),
    },
    razorpayEventId: input.razorpayEventId ?? null,
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType,
  }
}

/**
 * Build post-transaction side-effect functions from the SideEffect list.
 * These are pure async functions — no Prisma, no DB calls here.
 * Callers inject real implementations (or stubs in tests).
 */
export function buildSideEffects(
  effects: SideEffect[],
  context: {
    businessId: string
    subscriptionId: string
    toState: string
    graceUntil?: Date
  },
): SideEffectFn[] {
  return effects.map((effect) => {
    switch (effect) {
      case 'push_fanout':
        return async () => {
          // Stub: HP has no WS infrastructure yet. Log intent.
          logger.info('subscription.push_fanout_stub', {
            businessId: context.businessId,
            toState: context.toState,
          })
        }

      case 'enqueue_invoice':
        return async () => {
          // Stub: invoice generation queued post-state-change.
          logger.info('subscription.enqueue_invoice_stub', {
            businessId: context.businessId,
            subscriptionId: context.subscriptionId,
          })
        }

      case 'insert_promo_lock':
      case 'cancel_other_active':
      case 'set_grace':
      case 'clear_grace':
        return async () => {
          // These are handled inline in the writer transaction as Prisma calls.
          // The SideEffect label here is a signal — actual DB work done in writer.ts.
          logger.debug('subscription.side_effect_db', {
            effect,
            businessId: context.businessId,
          })
        }

      default:
        return async () => {
          logger.warn('subscription.unknown_side_effect', { effect })
        }
    }
  })
}

/**
 * Calculate grace period end date.
 */
export function gracePeriodEndsAt(now = new Date()): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + GRACE_PERIOD_DAYS)
  return d
}
