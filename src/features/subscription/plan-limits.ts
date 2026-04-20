/**
 * Frontend mirror of `server/src/config/plans.ts` PLAN_LIMITS.
 *
 * This file MUST stay in sync with the server. The plan snapshot test at
 * `server/src/__tests__/plan-limits.test.ts` prevents silent drift.
 */

export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS'

export interface PlanLimits {
  maxUsers: number
  maxInvoicesPerMonth: number
  gstFeatures: boolean
  customRoles: boolean
  multiGodown: boolean
  posMode: boolean
  tallyExport: boolean
  eInvoicing: boolean
  prioritySupport: boolean
  advancedReports: boolean
  accounting: boolean
  recurringInvoices: boolean
  batchTracking: boolean
  serialTracking: boolean
  taxReports: boolean
}

export type FeatureFlag = {
  [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never
}[keyof PlanLimits]

export const PLAN_HIERARCHY: Record<PlanTier, number> = {
  FREE: 0,
  PRO: 1,
  BUSINESS: 2,
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: {
    maxUsers: 1,
    maxInvoicesPerMonth: 50,
    gstFeatures: false,
    customRoles: false,
    multiGodown: false,
    posMode: false,
    tallyExport: false,
    eInvoicing: false,
    prioritySupport: false,
    advancedReports: false,
    accounting: false,
    recurringInvoices: false,
    batchTracking: false,
    serialTracking: false,
    taxReports: false,
  },
  PRO: {
    maxUsers: 3,
    maxInvoicesPerMonth: -1,
    gstFeatures: true,
    customRoles: true,
    multiGodown: false,
    posMode: false,
    tallyExport: false,
    eInvoicing: false,
    prioritySupport: true,
    advancedReports: true,
    accounting: true,
    recurringInvoices: true,
    batchTracking: false,
    serialTracking: false,
    taxReports: true,
  },
  BUSINESS: {
    maxUsers: -1,
    maxInvoicesPerMonth: -1,
    gstFeatures: true,
    customRoles: true,
    multiGodown: true,
    posMode: true,
    tallyExport: true,
    eInvoicing: true,
    prioritySupport: true,
    advancedReports: true,
    accounting: true,
    recurringInvoices: true,
    batchTracking: true,
    serialTracking: true,
    taxReports: true,
  },
}

export function isFeatureAllowed(plan: PlanTier, flag: FeatureFlag): boolean {
  return PLAN_LIMITS[plan][flag]
}

/** Minimum tier that unlocks this feature — used to render upgrade CTAs. */
export function minTierFor(flag: FeatureFlag): PlanTier {
  if (PLAN_LIMITS.PRO[flag]) return 'PRO'
  if (PLAN_LIMITS.BUSINESS[flag]) return 'BUSINESS'
  return 'BUSINESS'
}
