/** Dashboard — Constants and configuration
 *
 * All label maps, quick actions, and defaults.
 * No business logic here — pure data.
 */

import { ROUTES } from '@/config/routes.config'
import type { QuickAction, ActivityType } from './dashboard.types'

// ─── Quick actions (Figma: Create, Send, Pay, More) ────────────────────────

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id:    'new-invoice',
    label: 'Create',
    icon:  'FileText',
    route: `${ROUTES.INVOICE_CREATE}?type=SALE`,
    color: 'var(--color-primary-600)',
  },
  {
    id:    'send-invoice',
    label: 'Send',
    icon:  'Send',
    route: ROUTES.INVOICES,
    color: 'var(--color-info-600)',
  },
  {
    id:    'record-payment',
    label: 'Pay',
    icon:  'CreditCard',
    route: `${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`,
    color: 'var(--color-success-600)',
  },
  {
    id:    'more-actions',
    label: 'More',
    icon:  'MoreHorizontal',
    route: ROUTES.SETTINGS,
    color: 'var(--color-gray-600)',
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

// ─── WhatsApp reminder ─────────────────────────────────────────────────────

export function buildReminderMessage(name: string): string {
  return `Hi ${name}, this is a reminder about your pending payment. Please settle at your earliest convenience.`
}

// ─── Subscription pricing ──────────────────────────────────────────────────

export const SUBSCRIPTION_PRICE_LABEL = '\u20B9299'
