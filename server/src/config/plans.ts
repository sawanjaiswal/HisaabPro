/**
 * Subscription plan definitions — SSOT for gating logic.
 * Tier hierarchy: FREE < PRO < BUSINESS
 */

export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS'

export interface PlanLimits {
  maxUsers: number           // -1 = unlimited
  maxInvoicesPerMonth: number // -1 = unlimited
  gstFeatures: boolean
  customRoles: boolean
  multiGodown: boolean
  posMode: boolean
  tallyExport: boolean
  eInvoicing: boolean
  prioritySupport: boolean
}

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
  },
}

/** Grace period days for new businesses (Pro features free) */
export const TRIAL_DAYS = 30

/** Check if plan meets minimum tier requirement */
export function meetsMinPlan(current: PlanTier, required: PlanTier): boolean {
  return PLAN_HIERARCHY[current] >= PLAN_HIERARCHY[required]
}
