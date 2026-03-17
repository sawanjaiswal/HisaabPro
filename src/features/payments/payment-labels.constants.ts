/** Payment Labels — Type, mode, discount, and sort label maps
 *
 * Display labels, badge classes, icons, and placeholders for payment types and modes.
 */

import type {
  PaymentType,
  PaymentMode,
  PaymentDiscountType,
  PaymentSortBy,
} from './payment.types'

// ─── Payment type labels ──────────────────────────────────────────────────────

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  PAYMENT_IN:  'Payment In',
  PAYMENT_OUT: 'Payment Out',
}

// ─── Payment type badge CSS class variants ────────────────────────────────────
// CSS classes defined in the design system. No raw colors here.

export const PAYMENT_TYPE_BADGE: Record<PaymentType, string> = {
  PAYMENT_IN:  'badge-paid',
  PAYMENT_OUT: 'badge-overdue',
}

// ─── Payment mode labels ──────────────────────────────────────────────────────

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH:           'Cash',
  UPI:            'UPI',
  BANK_TRANSFER:  'Bank Transfer',
  CHEQUE:         'Cheque',
  NEFT_RTGS_IMPS: 'NEFT/RTGS/IMPS',
  CREDIT_CARD:    'Credit Card',
  OTHER:          'Other',
}

// ─── Payment mode icon names (lucide) ────────────────────────────────────────
// Referenced by icon components via name — no direct imports here.

export const PAYMENT_MODE_ICONS: Record<PaymentMode, string> = {
  CASH:           'banknote',
  UPI:            'smartphone',
  BANK_TRANSFER:  'building-2',
  CHEQUE:         'file-text',
  NEFT_RTGS_IMPS: 'arrow-right-left',
  CREDIT_CARD:    'credit-card',
  OTHER:          'circle-dot',
}

// ─── Reference number placeholder per mode ───────────────────────────────────
// Shown as the input placeholder in the "Reference Number" field.

export const REFERENCE_PLACEHOLDERS: Record<PaymentMode, string> = {
  CASH:           'Receipt Number',
  UPI:            'UPI Transaction ID',
  BANK_TRANSFER:  'Transaction Reference',
  CHEQUE:         'Cheque Number',
  NEFT_RTGS_IMPS: 'UTR Number',
  CREDIT_CARD:    'Approval Code',
  OTHER:          'Reference',
}

// ─── Modes that require a reference number ───────────────────────────────────
// CASH is excluded — reference is optional and hidden by default for cash.

export const MODES_WITH_REFERENCE: PaymentMode[] = [
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'NEFT_RTGS_IMPS',
  'CREDIT_CARD',
  'OTHER',
]

// ─── Discount type labels ─────────────────────────────────────────────────────

export const PAYMENT_DISCOUNT_TYPE_LABELS: Record<PaymentDiscountType, string> = {
  PERCENTAGE: 'Percentage (%)',
  FIXED:      'Fixed Amount (₹)',
}

// ─── Sort option labels ───────────────────────────────────────────────────────

export const PAYMENT_SORT_LABELS: Record<PaymentSortBy, string> = {
  date:      'Date',
  amount:    'Amount',
  createdAt: 'Created',
}
