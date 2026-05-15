/**
 * subscription.constants — FE display-side constants for subscription UI.
 *
 * Server is SSOT for actual pricing/feature gating. These are display labels
 * + tier ordering for the upgrade drawer and manage page.
 */

import type { PlanTier } from './plan-limits'
import type { SubscriptionState, MandateStatus } from './subscription.types'

/** Display order for the Upgrade drawer / tier comparison. */
export const PLAN_DISPLAY_ORDER: readonly PlanTier[] = [
  'FREE',
  'PRO',
  'BUSINESS',
  'PRO_MAX',
] as const

/** Monthly price in paise — display only; server is SSOT for billing. */
export const PLAN_PRICE_PAISE: Record<PlanTier, number> = {
  FREE: 0,
  PRO: 29900, // Rs 299/mo
  BUSINESS: 79900, // Rs 799/mo
  PRO_MAX: 199900, // Rs 1,999/mo
}

/** Translation-key suffix for each state's banner label. */
export const STATE_LABEL_KEY: Record<SubscriptionState, string> = {
  NONE: 'subStateNone',
  TRIAL_AUTOPAY: 'subStateTrialAutopay',
  TRIAL_NO_AUTOPAY: 'subStateTrialNoAutopay',
  ACTIVE: 'subStateActive',
  PAST_DUE: 'subStatePastDue',
  CANCELLED: 'subStateCancelled',
  LOCKED: 'subStateLocked',
}

/** Badge variant per state — maps to HP Badge's 5 variants. */
export const STATE_BADGE_VARIANT: Record<
  SubscriptionState,
  'paid' | 'pending' | 'overdue' | 'draft' | 'info'
> = {
  NONE: 'draft',
  TRIAL_AUTOPAY: 'info',
  TRIAL_NO_AUTOPAY: 'pending',
  ACTIVE: 'paid',
  PAST_DUE: 'pending',
  CANCELLED: 'draft',
  LOCKED: 'overdue',
}

export const MANDATE_LABEL_KEY: Record<MandateStatus, string> = {
  PENDING: 'mandatePending',
  ACTIVE: 'mandateActive',
  PAUSED: 'mandatePaused',
  REVOKED: 'mandateRevoked',
  FAILED: 'mandateFailed',
}

/** Clock-rewind tolerance — JWT rejected if Date.now() rewinds beyond this. */
export const CLOCK_REWIND_TOLERANCE_MS = 60_000

/** Silent refresh interval for the entitlement token (12h). */
export const ENTITLEMENT_REFRESH_MS = 12 * 60 * 60 * 1000

/** Poll interval for pending mandate status (30s). */
export const MANDATE_POLL_MS = 30_000
