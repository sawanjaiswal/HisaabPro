/**
 * gate-policy — the single source of truth for "what does the UI show for a
 * gated feature given the current subscription signal?".
 *
 * Failure-mode contract (mirrors the server floor in
 * `server/src/middleware/subscription-gate.ts`, which falls back to FREE when
 * the plan can't be resolved):
 *
 *   • The FE gate is UX-only — the server enforces entitlement on every
 *     request. So when the plan can't be verified we must NOT lock the user
 *     out of features they already have on every tier.
 *   • FREE-tier features (parties, products, invoicing, payments, …) are
 *     unlocked at every tier. They render in loading + error + success, and
 *     are blocked ONLY by a KNOWN LOCKED account (an account-liveness concern
 *     the server also enforces). No "Checking your plan…" flash, no
 *     "Couldn't verify your plan" lockout on a transient blip.
 *   • Paid features need a confirmed plan: on error/timeout we show a retry
 *     (never grant paid on uncertainty), while loading we wait.
 *
 * Keeping this pure and separate fences the fail-closed-on-uncertainty bug
 * class with unit tests, and leaves a seam for a future refactor that splits
 * account-liveness from feature-entitlement.
 */

import { isFeatureAllowed, type FeatureFlag, type PlanTier } from './plan-limits'
import type { SubscriptionState } from './subscription.types'

export type GateDecision = 'allow' | 'loading' | 'error' | 'upgrade'

export interface GateInput {
  feature: FeatureFlag
  plan: PlanTier
  state: SubscriptionState
  isInGrace: boolean
  isLoading: boolean
  isError: boolean
  timedOut: boolean
}

export function resolveGateAccess(input: GateInput): GateDecision {
  const { feature, plan, state, isInGrace, isLoading, isError, timedOut } = input

  const isFreeTier = isFeatureAllowed('FREE', feature)
  const knownLocked = state === 'LOCKED'

  // FREE-tier feature: entitled on every tier. Blocked only by a KNOWN LOCKED
  // account. When the plan is unverifiable (loading/error/timeout) we assume
  // the FREE floor and render — the server still gates mutations.
  if (isFreeTier) {
    return knownLocked ? 'upgrade' : 'allow'
  }

  // Paid feature: a confirmed plan is required to grant it.
  if (isError || timedOut) return 'error'
  if (isLoading) return 'loading'
  if (knownLocked) return 'upgrade'

  // In grace the server keeps the paid tier, so `plan` still reflects it.
  const allowed = isFeatureAllowed(plan, feature) || (isInGrace && isFeatureAllowed(plan, feature))
  return allowed ? 'allow' : 'upgrade'
}
