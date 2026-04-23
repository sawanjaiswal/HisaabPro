/**
 * Referral module — public API barrel.
 * Callers import from 'referral/index.js' (or referral.service.js redirect).
 */

export { generateReferralCode, getReferralCode, resolveCode } from './code.js'
export { applyReferralCode } from './fraud.js'
export { handleSubscriptionPayment, processEligibleRewards } from './rewards.js'
export type { ReferralStats, RewardListItem } from './stats.js'
export { getReferralStats, listRewards } from './stats.js'
export { requestWithdrawal, listWithdrawals } from './withdrawal.js'
