/** Payment Detail — Overview tab sub-component
 *
 * Renders the payment info rows: type, date, mode, reference,
 * amount, discount, unallocated, and notes.
 */

import { PAYMENT_TYPE_LABELS } from '../payment.constants'
import { formatPaymentMode } from '../payment.utils'
import type { PaymentType, PaymentMode, PaymentDiscount } from '../payment.types'

interface PaymentOverviewTabProps {
  type: PaymentType
  /** ISO date string */
  date: string
  mode: PaymentMode
  referenceNumber: string | null
  /** Total amount in PAISE */
  amount: number
  discount: PaymentDiscount | null
  /** Unallocated amount in PAISE */
  unallocatedAmount: number
  notes: string | null
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function PaymentOverviewTab({
  type,
  date,
  mode,
  referenceNumber,
  amount,
  discount,
  unallocatedAmount,
  notes,
}: PaymentOverviewTabProps) {
  return (
    <div className="card payment-overview-card">
      <div className="payment-info-row">
        <span className="payment-info-label">Type</span>
        <span className="payment-info-value">{PAYMENT_TYPE_LABELS[type]}</span>
      </div>
      <div className="payment-info-row">
        <span className="payment-info-label">Date</span>
        <span className="payment-info-value">{formatDate(date)}</span>
      </div>
      <div className="payment-info-row">
        <span className="payment-info-label">Mode</span>
        <span className="payment-info-value">{formatPaymentMode(mode)}</span>
      </div>
      {referenceNumber && (
        <div className="payment-info-row">
          <span className="payment-info-label">Reference</span>
          <span className="payment-info-value">{referenceNumber}</span>
        </div>
      )}
      <div className="payment-info-row payment-info-total">
        <span className="payment-info-label">Amount</span>
        <span className="payment-info-value">{formatAmount(amount)}</span>
      </div>
      {discount && (
        <div className="payment-info-row">
          <span className="payment-info-label">Discount</span>
          <span className="payment-info-value" style={{ color: 'var(--color-error-600)' }}>
            -{formatAmount(discount.calculatedAmount)}
            {discount.reason && ` (${discount.reason})`}
          </span>
        </div>
      )}
      <div className="payment-info-row">
        <span className="payment-info-label">Unallocated</span>
        <span className="payment-info-value">
          {unallocatedAmount > 0 ? formatAmount(unallocatedAmount) : 'Fully allocated'}
        </span>
      </div>
      {notes && (
        <div className="payment-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
          <span className="payment-info-label">Notes</span>
          <p style={{ lineHeight: 1.5, color: 'var(--color-gray-700)' }}>{notes}</p>
        </div>
      )}
    </div>
  )
}
