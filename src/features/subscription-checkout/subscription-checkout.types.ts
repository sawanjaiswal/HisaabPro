/**
 * Cross-platform checkout type contracts.
 *
 * HP is webhook-SSOT: the FE never grants entitlement. After the Razorpay
 * handler fires we POLL `/subscription/checkout/status` until the
 * webhook→FSM writer flips `subscriptionState` to a paid state (N3). The FSM
 * below models the UX of that flow only — it is never the source of truth.
 */

import type { PlanTier } from '@/features/subscription/plan-limits'
import type { SubscriptionState } from '@/features/subscription/subscription.types'

/** The three checkout surfaces. Picked by useCheckoutDevice. */
export type CheckoutSurface = 'android-native' | 'phone-web' | 'desktop-web'

export type BillingCycle = 'MONTHLY' | 'YEARLY'

/** POST /subscription/checkout response (server-trusted). */
export interface CheckoutSessionResponse {
  razorpaySubscriptionId: string
  checkoutUrl: string
  planTier: PlanTier
  amountPaise: number
  razorpayKeyId: string
}

/** GET /subscription/checkout/status response (poll target, UX-only). */
export interface CheckoutStatusResponse {
  subscriptionState: SubscriptionState
  planTier: PlanTier
}

/** Shape Razorpay (web checkout.js + native plugin) hands back on success. */
export interface RazorpayHandlerResponse {
  razorpay_payment_id?: string
  razorpay_subscription_id?: string
  razorpay_signature?: string
}

export type CheckoutErrorCode = 'NETWORK' | 'PROVIDER_UNREACHABLE' | 'PAYMENT_FAILED'

export type DismissReason = 'ondismiss' | 'opening_timeout'

/**
 * UX state machine. `polling` = handler fired, awaiting webhook activation.
 * Terminal-success requires the poll to observe a paid SubscriptionState —
 * never the handler callback alone (N3 invariant).
 */
export type CheckoutPhase =
  | { kind: 'idle' }
  | { kind: 'opening'; startedAt: number }
  | { kind: 'authorising'; subscriptionId: string }
  | { kind: 'polling'; subscriptionId: string; startedAt: number }
  | { kind: 'success'; state: SubscriptionState }
  | { kind: 'failed'; errorCode: CheckoutErrorCode }
  | { kind: 'cancelled'; reason: DismissReason }
  | { kind: 'stranded'; subscriptionId: string }

export type CheckoutPhaseKind = CheckoutPhase['kind']

export type CheckoutEvent =
  | { kind: 'open_clicked' }
  | { kind: 'razorpay_opened'; subscriptionId: string }
  | { kind: 'opening_timeout_elapsed' }
  | { kind: 'handler_fired'; subscriptionId: string }
  | { kind: 'poll_active'; state: SubscriptionState }
  | { kind: 'poll_timeout' }
  | { kind: 'checkout_error'; errorCode: CheckoutErrorCode }
  | { kind: 'dismiss_observed'; reason: DismissReason }
  | { kind: 'user_retry' }
  | { kind: 'reset' }

/** Props shared by all three surface components. */
export interface CheckoutSurfaceProps {
  session: CheckoutSessionResponse
  onEvent: (event: CheckoutEvent) => void
  phase: CheckoutPhase
}
