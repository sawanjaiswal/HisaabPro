/** Dashboard — Constants and configuration
 *
 * All label maps, quick actions, and defaults.
 * No business logic here — pure data.
 */

import { ROUTES } from '@/config/routes.config'
import type { QuickAction, ActivityType } from './dashboard.types'

// ─── Quick actions ────────────────────────────────────────────────────────────

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id:    'new-invoice',
    label: 'Create',
    icon:  'FileText',
    route: `${ROUTES.INVOICE_CREATE}?type=SALE`,
    color: 'var(--color-primary-600)',
  },
  {
    id:    'record-payment',
    label: 'Payment',
    icon:  'Banknote',
    route: `${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`,
    color: 'var(--color-success-600)',
  },
  {
    id:    'add-product',
    label: 'Products',
    icon:  'Package',
    route: ROUTES.PRODUCT_NEW,
    color: 'var(--color-warning-600)',
  },
  {
    id:    'add-party',
    label: 'Parties',
    icon:  'Users',
    route: ROUTES.PARTY_NEW,
    color: 'var(--color-info-600)',
  },
]

// ─── Activity type labels & colors ──────────────────────────────────────────

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  sale_invoice:     'Sale Invoice',
  purchase_invoice: 'Purchase Invoice',
  payment_in:       'Payment In',
  payment_out:      'Payment Out',
}

// ─── Section limits ─────────────────────────────────────────────────────────

export const TOP_DEBTORS_LIMIT = 5
export const RECENT_ACTIVITY_LIMIT = 10

// ─── Today snapshot labels ──────────────────────────────────────────────────

export const TODAY_LABELS = {
  sales:    'Sales',
  received: 'Received',
  net:      'Net',
} as const
