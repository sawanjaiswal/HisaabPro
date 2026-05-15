/**
 * Subscription plan definitions — SSOT for gating logic.
 * Tier hierarchy: FREE < PRO < BUSINESS < PRO_MAX
 */

export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'PRO_MAX'

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
  advancedReports: boolean
  accounting: boolean
  recurringInvoices: boolean
  batchTracking: boolean
  serialTracking: boolean
  taxReports: boolean
  invoicing: boolean
  products: boolean
  parties: boolean
  payments: boolean
  expenses: boolean
  basicReports: boolean
  bulkImport: boolean
  backup: boolean
  bankAccounts: boolean
  cheques: boolean
  stockAdjustments: boolean
  paymentReminders: boolean
  barcodes: boolean
}

export const PLAN_HIERARCHY: Record<PlanTier, number> = {
  FREE: 0,
  PRO: 1,
  BUSINESS: 2,
  PRO_MAX: 3,
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
    invoicing: true,
    products: true,
    parties: true,
    payments: true,
    expenses: true,
    basicReports: true,
    bulkImport: true,
    backup: true,
    bankAccounts: true,
    cheques: true,
    stockAdjustments: true,
    paymentReminders: true,
    barcodes: true,
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
    invoicing: true,
    products: true,
    parties: true,
    payments: true,
    expenses: true,
    basicReports: true,
    bulkImport: true,
    backup: true,
    bankAccounts: true,
    cheques: true,
    stockAdjustments: true,
    paymentReminders: true,
    barcodes: true,
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
    invoicing: true,
    products: true,
    parties: true,
    payments: true,
    expenses: true,
    basicReports: true,
    bulkImport: true,
    backup: true,
    bankAccounts: true,
    cheques: true,
    stockAdjustments: true,
    paymentReminders: true,
    barcodes: true,
  },
  PRO_MAX: {
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
    invoicing: true,
    products: true,
    parties: true,
    payments: true,
    expenses: true,
    basicReports: true,
    bulkImport: true,
    backup: true,
    bankAccounts: true,
    cheques: true,
    stockAdjustments: true,
    paymentReminders: true,
    barcodes: true,
  },
}

/** Grace period days for new businesses (Pro features free) */
export const TRIAL_DAYS = 30

/** Check if plan meets minimum tier requirement */
export function meetsMinPlan(current: PlanTier, required: PlanTier): boolean {
  return PLAN_HIERARCHY[current] >= PLAN_HIERARCHY[required]
}
