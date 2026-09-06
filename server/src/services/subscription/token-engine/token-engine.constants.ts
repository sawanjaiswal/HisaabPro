/**
 * Token-billing engine constants (epic token-billing-engine).
 *
 * Every number the engine schedules or asserts against lives here.
 */

import crypto from 'crypto'

/* ------------------------------------------------------------------ */
/* Mandate ceiling                                                    */
/* ------------------------------------------------------------------ */

/**
 * Mandate max_amount = min(price * CEILING_MULTIPLIER, CEILING_CAP).
 * 3x headroom lets us raise the plan price without re-registering every mandate;
 * Rs 15,000 is the UPI Autopay AFA-free ceiling.
 */
export const CEILING_MULTIPLIER = 3
export const CEILING_CAP_PAISE = 15_000 * 100

export function mandateCeilingPaise(pricePaise: number): number {
  return Math.min(pricePaise * CEILING_MULTIPLIER, CEILING_CAP_PAISE)
}

/** Auth-leg charge for checkout_order registration (Rs 1, refund-free). */
export const AUTH_AMOUNT_PAISE = 100

/** Intro promo period days. */
export const PROMO_FIRST_PERIOD_DAYS = 7

/* ------------------------------------------------------------------ */
/* Charge ladder                                                      */
/* ------------------------------------------------------------------ */

export const GRACE_DAYS = 3
export const MAX_ATTEMPTS = 3

/** Call-day offset from period end E for a 1-based attemptNo: E + (N-2) days. */
export function attemptCallOffsetDays(attemptNo: number): number {
  return attemptNo - 2
}

/**
 * Scheduler pickup window: attempts with chargeAt <= now + 26h are due.
 * 26h = ~25h notification-to-debit lag + 1h cron jitter.
 */
export const CHARGE_WINDOW_HOURS = 26
export const CHARGE_WINDOW_MS = CHARGE_WINDOW_HOURS * 60 * 60 * 1000

/* ------------------------------------------------------------------ */
/* Scheduler batch + poison handling                                  */
/* ------------------------------------------------------------------ */

export const CHARGE_BATCH_CAP = 25
export const QUEUE_DEPTH_ALERT_TICKS = 3
export const POISON_ATTEMPT_TTL_MS = 30 * 60 * 1000
export const MANDATE_PENDING_TTL_MS = 10 * 60 * 1000
export const PENDING_MANDATE_SWEEP_MS = MANDATE_PENDING_TTL_MS
export const STALE_PENDING_SUPERSEDE_MS = 0
export const PENDING_MANDATE_SWEEP_CRON = '*/5 * * * *'

/* ------------------------------------------------------------------ */
/* Receipt key                                                        */
/* ------------------------------------------------------------------ */

export const RECEIPT_KEY_LENGTH = 20

export function generateReceiptKey(): string {
  return crypto.randomBytes(10).toString('hex')
}

/* ------------------------------------------------------------------ */
/* Registration                                                       */
/* ------------------------------------------------------------------ */

export const REGLINK_ALLOWED_HOSTS = ['razorpay.com', 'rzp.io'] as const
export const TOKEN_FREQUENCY = 'as_presented' as const
export const MANDATE_EXPIRE_YEARS = 10
