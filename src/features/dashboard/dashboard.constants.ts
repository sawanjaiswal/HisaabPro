/** Dashboard — Constants and configuration
 *
 * All label maps, quick actions, and defaults.
 * No business logic here — pure data.
 */

import { ROUTES } from '@/config/routes.config'
import type { QuickAction, ActivityType } from './dashboard.types'
import type { TranslationKey } from '@/lib/translations'

// ─── Quick actions (Figma: Create, Send, Pay, More) ────────────────────────
// Labels are translation keys — resolved at render time via t[action.labelKey]

export interface QuickActionConfig extends QuickAction {
  labelKey: TranslationKey
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id:    'view-inventory',
    labelKey: 'inventory',
    icon:  'Package',
    route: ROUTES.PRODUCTS,
    color: 'var(--color-primary-600)',
  },
  {
    id:    'view-reports',
    labelKey: 'reports',
    icon:  'BarChart3',
    route: ROUTES.REPORTS,
    color: 'var(--color-info-600)',
  },
  {
    id:    'record-payment',
    labelKey: 'pay',
    icon:  'CreditCard',
    route: `${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`,
    color: 'var(--color-success-600)',
  },
  {
    id:    'more-actions',
    labelKey: 'more',
    icon:  'MoreHorizontal',
    route: ROUTES.MORE,
    color: 'var(--color-gray-600)',
  },
]

// ─── Activity type label keys ───────────────────────────────────────────────

export const ACTIVITY_TYPE_LABEL_KEYS: Record<ActivityType, TranslationKey> = {
  sale_invoice:     'saleInvoice',
  purchase_invoice: 'purchaseInvoice',
  payment_in:       'paymentIn',
  payment_out:      'paymentOut',
}

// ─── Section limits ─────────────────────────────────────────────────────────

export const TOP_DEBTORS_LIMIT = 5
export const RECENT_ACTIVITY_LIMIT = 10

// ─── WhatsApp reminder ─────────────────────────────────────────────────────

export function buildReminderMessage(name: string, reminderText: string): string {
  return `Hi ${name}, ${reminderText}`
}

// ─── Subscription pricing ──────────────────────────────────────────────────

export const SUBSCRIPTION_PRICE_LABEL = '\u20B9299'
