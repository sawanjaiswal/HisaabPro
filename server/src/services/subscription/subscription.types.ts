/**
 * Subscription domain types — shared across writer, state-machine, services.
 * No Prisma imports — pure TypeScript.
 */

// ─── State Machine ────────────────────────────────────────────────────────────

export type SubscriptionState =
  | 'NONE'
  | 'PROMO_ACTIVE'
  | 'TRIAL_NO_AUTOPAY'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'LOCKED'
  | 'CANCELLED'

export type NullableSubscriptionState = SubscriptionState | null

export type StateTrigger =
  | 'payment.captured.promo'
  | 'payment.captured.full'
  | 'payment.captured.recurring'
  | 'admin.force_activate'
  | 'mandate.created'
  | 'mandate.cancelled'
  | 'subscription.charged.failed'
  | 'day31.reached.no_mandate'
  | 'grace.expired'
  | 'user.cancel'

export type SideEffect =
  | 'insert_promo_lock'
  | 'cancel_other_active'
  | 'enqueue_invoice'
  | 'push_fanout'
  | 'set_grace'
  | 'clear_grace'

export interface StateTransitionResult {
  toState: SubscriptionState
  sideEffects: SideEffect[]
}

export class InvalidTransitionError extends Error {
  public readonly code = 'INVALID_STATE_TRANSITION' as const
  public readonly httpStatus = 409

  constructor(from: NullableSubscriptionState, trigger: StateTrigger) {
    super(`No transition from state ${from ?? 'null'} on trigger ${trigger}`)
    this.name = 'InvalidTransitionError'
  }
}

// ─── Mandate ─────────────────────────────────────────────────────────────────

export type MandateStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'FAILED'

// ─── Plan tier ───────────────────────────────────────────────────────────────

export type SubscriptionPlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'PRO_MAX'

export type PaymentMethod = 'UPI_AUTOPAY' | 'CARD' | 'MANUAL' | 'RAZORPAY'

// ─── Writer event input ───────────────────────────────────────────────────────

export interface ApplyEventInput {
  businessId: string
  subscriptionId: string
  trigger: StateTrigger
  razorpayEventId?: string
  payload?: Record<string, unknown>
  actorUserId?: string
  actorType: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'ADMIN' | 'CRON'
  planTier?: SubscriptionPlanTier
  amount?: number   // Int paise — never float
}

// ─── Entitlement JWT claims ───────────────────────────────────────────────────

export interface EntitlementClaims {
  iss: 'hisaabpro-api'
  aud: 'hisaabpro-client'
  sub: string        // subscriptionId
  bid: string        // businessId
  tier: SubscriptionPlanTier
  state: SubscriptionState
  graceUntil: string | null
  features: Record<string, boolean>
  addons: string[]
  trustedTime: string  // ISO — for clock-rewind detection
  jti: string
}
