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
    id:    'create-invoice',
    labelKey: 'invoice',
    icon:  'FileText',
    route: `${ROUTES.INVOICE_CREATE}?type=SALE`,
    color: 'var(--color-primary-600)',
  },
  {
    id:    'add-customer',
    labelKey: 'quickActionCustomer',
    icon:  'User',
    route: ROUTES.PARTY_NEW,
    color: 'var(--color-info-600)',
  },
  {
    id:    'add-product',
    labelKey: 'quickActionProduct',
    icon:  'Package',
    route: ROUTES.PRODUCT_NEW,
    color: 'var(--color-success-600)',
  },
  {
    id:    'add-expense',
    labelKey: 'quickActionExpense',
    icon:  'Receipt',
    route: ROUTES.EXPENSES,
    color: 'var(--color-warning-600)',
  },
  {
    id:    'quick-payment',
    labelKey: 'pay',
    icon:  'CreditCard',
    route: `${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`,
    color: 'var(--color-success-600)',
  },
  {
    id:    'add-purchase',
    labelKey: 'quickActionPurchase',
    icon:  'ShoppingCart',
    route: ROUTES.PURCHASE_NEW,
    color: 'var(--color-info-600)',
  },
  {
    id:    'view-inventory',
    labelKey: 'inventory',
    icon:  'Warehouse',
    route: ROUTES.PRODUCTS,
    color: 'var(--color-primary-600)',
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
