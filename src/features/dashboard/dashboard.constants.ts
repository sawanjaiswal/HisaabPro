/** Dashboard — Constants and configuration
 *
 * All label maps, quick actions, and defaults.
 * No business logic here — pure data.
 */

import { ROUTES } from '@/config/routes.config'
import type { DashboardRange, QuickAction, DashboardFilters } from './dashboard.types'

// ─── Range labels ─────────────────────────────────────────────────────────────

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  today:      'Today',
  this_week:  'This Week',
  this_month: 'This Month',
  custom:     'Custom',
}

/** Ordered list for rendering range pill tabs */
export const DASHBOARD_RANGES: DashboardRange[] = [
  'today',
  'this_week',
  'this_month',
  'custom',
]

// ─── Outstanding config ───────────────────────────────────────────────────────

/** Max customers shown in top-outstanding section */
export const TOP_OUTSTANDING_LIMIT = 5

// ─── Quick actions ────────────────────────────────────────────────────────────
// Colors are CSS variable references only — never raw hex.

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id:    'new-invoice',
    label: 'New Invoice',
    icon:  'FileText',
    route: `${ROUTES.INVOICE_CREATE}?type=SALE`,
    color: 'var(--color-primary-600)',
  },
  {
    id:    'record-payment',
    label: 'Record Payment',
    icon:  'Banknote',
    route: `${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`,
    color: 'var(--color-success-600)',
  },
  {
    id:    'add-product',
    label: 'Add Product',
    icon:  'Package',
    route: ROUTES.PRODUCT_NEW,
    color: 'var(--color-warning-600)',
  },
  {
    id:    'add-party',
    label: 'Add Party',
    icon:  'Users',
    route: ROUTES.PARTY_NEW,
    color: 'var(--color-info-600)',
  },
]

// ─── Default filter state ─────────────────────────────────────────────────────

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  range: 'today',
}

// ─── Summary card display labels ──────────────────────────────────────────────

export const DASHBOARD_CARD_LABELS = {
  sales:      'Sales',
  purchases:  'Purchases',
  receivable: 'Receivable',
  payable:    'Payable',
} as const

export const DASHBOARD_CARD_SUBLABELS = {
  invoices: 'invoices',
  parties:  'parties',
} as const

// ─── Cash flow labels ─────────────────────────────────────────────────────────

export const DASHBOARD_CASHFLOW_LABELS = {
  received:    'Received',
  paid:        'Paid',
  netCashFlow: 'Net Cash Flow',
} as const
