/**
 * Checkout-phase reducer (pure FSM) + helpers.
 *
 * Stateless: every transition is `(phase, event) -> phase`. No I/O, no React.
 * HP-native (webhook-SSOT): the `polling` phase waits for the webhook→FSM
 * writer; success is only reached when the poll observes a paid state.
 */

import type {
  CheckoutPhase,
  CheckoutEvent,
} from '../subscription-checkout.types'
import { SUCCESS_STATES } from '../subscription-checkout.constants'
import type { SubscriptionState } from '@/features/subscription/subscription.types'

export function initialPhase(): CheckoutPhase {
  return { kind: 'idle' }
}

export function isPaidState(state: SubscriptionState): boolean {
  return SUCCESS_STATES.has(state)
}

export function nextPhase(p: CheckoutPhase, e: CheckoutEvent): CheckoutPhase {
  if (e.kind === 'reset') return { kind: 'idle' }

  switch (p.kind) {
    case 'idle':
      if (e.kind === 'open_clicked') return { kind: 'opening', startedAt: Date.now() }
      return p

    case 'opening':
      if (e.kind === 'razorpay_opened')
        return { kind: 'authorising', subscriptionId: e.subscriptionId }
      if (e.kind === 'opening_timeout_elapsed') return { kind: 'failed', errorCode: 'NETWORK' }
      if (e.kind === 'checkout_error') return { kind: 'failed', errorCode: e.errorCode }
      if (e.kind === 'dismiss_observed') return { kind: 'cancelled', reason: e.reason }
      return p

    case 'authorising':
      if (e.kind === 'handler_fired')
        return { kind: 'polling', subscriptionId: e.subscriptionId, startedAt: Date.now() }
      if (e.kind === 'checkout_error') return { kind: 'failed', errorCode: e.errorCode }
      if (e.kind === 'dismiss_observed') return { kind: 'cancelled', reason: e.reason }
      return p

    case 'polling':
      // N3: only land in success when the poll observes a PAID state.
      if (e.kind === 'poll_active' && isPaidState(e.state))
        return { kind: 'success', state: e.state }
      if (e.kind === 'poll_timeout') return { kind: 'stranded', subscriptionId: p.subscriptionId }
      return p

    case 'failed':
    case 'stranded':
      if (e.kind === 'user_retry') {
        const subId = p.kind === 'stranded' ? p.subscriptionId : null
        if (subId) return { kind: 'polling', subscriptionId: subId, startedAt: Date.now() }
        return { kind: 'idle' }
      }
      return p

    case 'success':
    case 'cancelled':
      return p
  }
}

export function isTerminal(p: CheckoutPhase): boolean {
  return p.kind === 'success' || p.kind === 'failed' || p.kind === 'cancelled'
}
