/**
 * Razorpay plan + subscription grace-period env helpers.
 */

/** Razorpay PRO_MAX plan ID. Optional — prints warning if absent. */
export function getRazorpayPlanProMax(): string | undefined {
  const id = process.env.RAZORPAY_PLAN_PRO_MAX
  if (!id) {
    // warn on first call only
    process.env._RAZORPAY_PRO_MAX_WARNED ??= 'true'
    if (process.env._RAZORPAY_PRO_MAX_WARNED === 'true') {
      process.env._RAZORPAY_PRO_MAX_WARNED = 'warned'
    }
  }
  return id
}

/**
 * Resolve the Razorpay plan ID for a paid tier + billing cycle.
 *
 * A YEARLY checkout with a missing `RAZORPAY_PLAN_<TIER>_YEARLY` env var must
 * NOT silently fall back to the monthly plan — that would bill a yearly buyer
 * a monthly plan. The caller maps `{ ok: false }` to a 503 so the buyer is
 * never charged the wrong cadence.
 */
export type RazorpayPlanResolution =
  | { ok: true; planId: string }
  | { ok: false; missing: 'MONTHLY' | 'YEARLY' }

export function getRazorpayPlanId(
  tier: 'PRO' | 'BUSINESS' | 'PRO_MAX',
  cycle: 'MONTHLY' | 'YEARLY',
): RazorpayPlanResolution {
  const monthly: Record<typeof tier, string | undefined> = {
    PRO: process.env.RAZORPAY_PLAN_PRO,
    BUSINESS: process.env.RAZORPAY_PLAN_BUSINESS,
    PRO_MAX: process.env.RAZORPAY_PLAN_PRO_MAX,
  }
  const monthlyId = monthly[tier]
  if (!monthlyId) return { ok: false, missing: 'MONTHLY' }
  if (cycle === 'YEARLY') {
    const yearlyId = process.env[`RAZORPAY_PLAN_${tier}_YEARLY`]
    if (!yearlyId) return { ok: false, missing: 'YEARLY' }
    return { ok: true, planId: yearlyId }
  }
  return { ok: true, planId: monthlyId }
}

/** Overflow grace period days. Default 3. */
export function getOverflowGraceDays(): number {
  return parseInt(process.env.SUBSCRIPTION_OVERFLOW_GRACE_DAYS ?? '3', 10)
}

/** Subscription grace period days (for PAST_DUE). Default 7. */
export function getSubscriptionGraceDays(): number {
  return parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS ?? '7', 10)
}
