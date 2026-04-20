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
  // Paid-gating v2 (2026-04-21)
  advancedReports: boolean   // P&L, Balance Sheet, Cash Flow, Aging, Profitability, Discounts
  accounting: boolean        // CoA, Journal, Trial Balance, Bank, Loans, Cheques
  recurringInvoices: boolean
  batchTracking: boolean
  serialTracking: boolean
  taxReports: boolean        // GST returns + TDS/TCS reconciliation

  // Universal gating v3 (2026-04-21) — currently free on every tier, flags exist
  // so any one can be flipped to `false` for FREE without touching product code.
  invoicing: boolean         // sale invoices, estimates, proforma, DC
  products: boolean          // catalog + stock
  parties: boolean           // customers/suppliers
  payments: boolean          // payment record + allocations
  expenses: boolean
  basicReports: boolean      // sales/purchase/inventory summaries
  bulkImport: boolean        // CSV import
  backup: boolean            // data export / backup
  bankAccounts: boolean      // non-accounting bank ledger
  cheques: boolean
  stockAdjustments: boolean
  paymentReminders: boolean
  barcodes: boolean
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
    advancedReports: false,
    accounting: false,
    recurringInvoices: false,
    batchTracking: false,
    serialTracking: false,
    taxReports: false,
    // Universal flags — free today. Flip to false to gate on FREE.
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
}

/** Grace period days for new businesses (Pro features free) */
export const TRIAL_DAYS = 30

/** Check if plan meets minimum tier requirement */
export function meetsMinPlan(current: PlanTier, required: PlanTier): boolean {
  return PLAN_HIERARCHY[current] >= PLAN_HIERARCHY[required]
}
