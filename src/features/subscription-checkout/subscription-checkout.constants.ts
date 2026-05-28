/** Cross-platform checkout timing + state constants. */

import type { SubscriptionState } from '@/features/subscription/subscription.types'

/** Status poll cadence while waiting for webhook activation. */
export const POLL_INTERVAL_MS = 3_000

/** Give up polling after this; payment likely went through → 'stranded'. */
export const POLL_TIMEOUT_MS = 120_000

/** If the Razorpay UI never appears, treat as a network failure. */
export const OPENING_TIMEOUT_MS = 10_000

/** Razorpay checkout.js CDN (phone-web surface only). */
export const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

/** Native capacitor-razorpay registers itself under this plugin name. */
export const NATIVE_RAZORPAY_PLUGIN = 'Checkout'

/**
 * Paid states the poll treats as terminal-success. The webhook→FSM writer
 * only reaches these once Razorpay confirms the mandate/charge. TRIAL_AUTOPAY
 * = mandate registered, first charge scheduled (the N3 "awaiting" analogue).
 */
export const SUCCESS_STATES: ReadonlySet<SubscriptionState> = new Set<SubscriptionState>([
  'ACTIVE',
  'TRIAL_AUTOPAY',
])
