/**
 * Creates a Razorpay checkout session: POST /subscription/checkout.
 *
 * Online-only (the server wraps Razorpay). The session carries the
 * server-trusted razorpayKeyId, subscriptionId and checkoutUrl that every
 * surface component needs. This is a mutation (creates a Razorpay sub), so it
 * is never cached and never offline-queued.
 */

import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  BillingCycle,
  CheckoutSessionResponse,
} from '../subscription-checkout.types'
import type { PlanTier } from '@/features/subscription/plan-limits'

export interface CreateCheckoutArgs {
  tier: PlanTier
  billingCycle: BillingCycle
  couponCode?: string
}

export function useCheckoutSession() {
  return useMutation<CheckoutSessionResponse, Error, CreateCheckoutArgs>({
    mutationFn: (args) =>
      api<CheckoutSessionResponse>('/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify(args),
        entityType: 'subscription',
        entityLabel: `${args.tier} ${args.billingCycle.toLowerCase()}`,
        offlineQueue: false,
      }),
  })
}
