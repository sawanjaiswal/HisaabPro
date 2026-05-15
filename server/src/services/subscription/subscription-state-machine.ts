/**
 * Subscription State Machine — pure logic, NO side-effects, NO Prisma.
 * Call transitionState(from, trigger) to get the next state + side-effects.
 * Any transition not in the table throws InvalidTransitionError (HTTP 409).
 *
 * 19 transitions per architecture §3.
 */

import type {
  NullableSubscriptionState,
  SubscriptionState,
  StateTrigger,
  SideEffect,
  StateTransitionResult,
} from './subscription.types.js'
import { InvalidTransitionError } from './subscription.types.js'

// ─── Transition table ─────────────────────────────────────────────────────────

interface TransitionRow {
  from: NullableSubscriptionState
  trigger: StateTrigger
  to: SubscriptionState
  sideEffects: SideEffect[]
}

const TRANSITIONS: TransitionRow[] = [
  // 1
  { from: null, trigger: 'payment.captured.promo', to: 'PROMO_ACTIVE', sideEffects: ['insert_promo_lock', 'cancel_other_active', 'enqueue_invoice', 'push_fanout'] },
  // 2
  { from: null, trigger: 'payment.captured.full', to: 'ACTIVE', sideEffects: ['cancel_other_active', 'enqueue_invoice', 'push_fanout'] },
  // 3
  { from: null, trigger: 'admin.force_activate', to: 'ACTIVE', sideEffects: ['enqueue_invoice'] },
  // 4
  { from: 'NONE', trigger: 'admin.force_activate', to: 'ACTIVE', sideEffects: ['enqueue_invoice'] },
  // 5
  { from: 'PROMO_ACTIVE', trigger: 'payment.captured.recurring', to: 'ACTIVE', sideEffects: ['clear_grace', 'enqueue_invoice', 'push_fanout'] },
  // 6
  { from: 'PROMO_ACTIVE', trigger: 'mandate.cancelled', to: 'TRIAL_NO_AUTOPAY', sideEffects: [] },
  // 7
  { from: 'PROMO_ACTIVE', trigger: 'subscription.charged.failed', to: 'PAST_DUE', sideEffects: ['set_grace', 'push_fanout'] },
  // 8
  { from: 'TRIAL_NO_AUTOPAY', trigger: 'mandate.created', to: 'PROMO_ACTIVE', sideEffects: ['clear_grace'] },
  // 9
  { from: 'TRIAL_NO_AUTOPAY', trigger: 'day31.reached.no_mandate', to: 'PAST_DUE', sideEffects: ['set_grace', 'push_fanout'] },
  // 10
  { from: 'ACTIVE', trigger: 'subscription.charged.failed', to: 'PAST_DUE', sideEffects: ['set_grace', 'push_fanout'] },
  // 11
  { from: 'ACTIVE', trigger: 'user.cancel', to: 'CANCELLED', sideEffects: [] },
  // 12 — mandate cancelled while ACTIVE: no state change; next charge will just fail
  { from: 'ACTIVE', trigger: 'mandate.cancelled', to: 'ACTIVE', sideEffects: [] },
  // P2-K: allow full payment from TRIAL_NO_AUTOPAY → ACTIVE
  { from: 'TRIAL_NO_AUTOPAY', trigger: 'payment.captured.full', to: 'ACTIVE', sideEffects: ['cancel_other_active', 'enqueue_invoice', 'push_fanout'] },
  // 13
  { from: 'PAST_DUE', trigger: 'payment.captured.full', to: 'ACTIVE', sideEffects: ['clear_grace', 'enqueue_invoice', 'push_fanout'] },
  // 14
  { from: 'PAST_DUE', trigger: 'payment.captured.recurring', to: 'ACTIVE', sideEffects: ['clear_grace', 'enqueue_invoice', 'push_fanout'] },
  // 15
  { from: 'PAST_DUE', trigger: 'grace.expired', to: 'LOCKED', sideEffects: ['push_fanout'] },
  // 16
  { from: 'PAST_DUE', trigger: 'admin.force_activate', to: 'ACTIVE', sideEffects: ['clear_grace', 'enqueue_invoice'] },
  // 17
  { from: 'LOCKED', trigger: 'payment.captured.full', to: 'ACTIVE', sideEffects: ['cancel_other_active', 'enqueue_invoice', 'push_fanout'] },
  // 18
  { from: 'LOCKED', trigger: 'admin.force_activate', to: 'ACTIVE', sideEffects: ['clear_grace', 'enqueue_invoice'] },
  // 19
  { from: 'CANCELLED', trigger: 'payment.captured.full', to: 'ACTIVE', sideEffects: ['cancel_other_active', 'enqueue_invoice', 'push_fanout'] },
]

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Pure state transition — throws InvalidTransitionError if not in table.
 * Unit-testable: no side-effects, no I/O.
 */
export function transitionState(
  from: NullableSubscriptionState,
  trigger: StateTrigger,
): StateTransitionResult {
  const row = TRANSITIONS.find(
    (t) => t.from === from && t.trigger === trigger,
  )

  if (!row) {
    throw new InvalidTransitionError(from, trigger)
  }

  return { toState: row.to, sideEffects: row.sideEffects }
}

/** Returns true if a transition is allowed (no-throw variant). */
export function canTransition(
  from: NullableSubscriptionState,
  trigger: StateTrigger,
): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.trigger === trigger)
}
