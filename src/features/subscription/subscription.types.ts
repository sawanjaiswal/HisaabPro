/**
 * subscription.types — FE shared types for the subscription feature.
 *
 * Mirrors `server/src/services/subscription/subscription.types.ts` minus
 * server-internal fields. Keep in sync — drift is caught by the
 * plan-limits.drift test (for tier names) and by tsc on api() generics.
 */

import type { PlanTier } from './plan-limits'

/** State-machine states — must match server enum `SubscriptionState`. */
export type SubscriptionState =
  | 'NONE'
  | 'TRIAL_AUTOPAY'
  | 'TRIAL_NO_AUTOPAY'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'LOCKED'

/** Razorpay-style status reported by the server. */
export type SubscriptionStatus =
  | 'ACTIVE'
  | 'CANCELLED'
  | 'PAST_DUE'
  | 'TRIALING'
  | 'NONE'

/** UPI Autopay mandate status. */
export type MandateStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REVOKED'
  | 'FAILED'

/** Known addon codes — server is SSOT; this list is for UI display only. */
export type AddonCode =
  | 'pos_mode'
  | 'multi_godown'
  | 'tally_export'
  | 'e_invoicing'
  | 'batch_tracking'
  | 'serial_tracking'

export interface ActiveAddon {
  code: AddonCode | string
  label: string
  expiresAt: string | null
}

export interface SubscriptionUsage {
  invoices: { used: number; limit: number }
  users: { used: number; limit: number }
}

/** Shape returned by `GET /businesses/:id/subscription`. */
export interface SubscriptionData {
  plan: PlanTier
  status: SubscriptionStatus
  state: SubscriptionState
  expiresAt: string | null
  trialEndsAt: string | null
  graceUntil: string | null
  isTrialing: boolean
  autoRenew: boolean
  nextBillingAt: string | null
  paymentMethod: 'MANUAL' | 'UPI_AUTOPAY' | 'CARD' | null
  mandate: { id: string | null; status: MandateStatus | null } | null
  addons: ActiveAddon[]
  /** RS256 JWT — null when server has no signing key configured. */
  offlineToken: string | null
  usage: SubscriptionUsage
}

/** Verified entitlement JWT claims (after WebCrypto verify). */
export interface EntitlementClaims {
  iss: string
  sub: string // subscriptionId
  aud: string
  iat: number
  exp: number
  jti: string
  bid: string // businessId
  uid: string // userId
  tier: PlanTier
  state: SubscriptionState
  graceUntil: string | null
  features: Record<string, boolean>
  addons: string[]
  trustedTime: string // ISO server-now
}

/** Local cache row (IDB `entitlement` store). */
export interface EntitlementCacheRow {
  token: string
  exp: number
  trustedTime: number // ms epoch
  clockSkew: number // Date.now() - trustedTimeMs at receive
  storedAt: number // monotonic baseline (ms epoch at receive)
}
