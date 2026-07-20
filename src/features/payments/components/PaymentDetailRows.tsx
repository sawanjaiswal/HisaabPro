/** Payment Details — the label/value rows (mockup #42).
 *
 * Date, mode, reference, invoice numbers, amount, discount, unallocated and
 * notes on one card. Rows with no data are omitted rather than shown blank.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import { formatPaymentMode } from '../payment.utils'
import type { PaymentType, PaymentMode, PaymentDiscount, PaymentAllocation } from '../payment.types'
import { PAYMENT_TYPE_LABELS } from '../payment.constants'

interface PaymentDetailRowsProps {
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
  allocations: PaymentAllocation[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function PaymentDetailRows({
  type,
  date,
  mode,
  referenceNumber,
  amount,
  discount,
  unallocatedAmount,
  notes,
  allocations,
}: PaymentDetailRowsProps) {
  const { t } = useLanguage()
  const invoiceNumbers = allocations.map((a) => a.invoiceNumber).join(', ')

  return (
    <div className="payment-info-card">
      <div className="payment-info-row">
        <span className="payment-info-label">{t.typeInfoLabel}</span>
        <span className="payment-info-value">{PAYMENT_TYPE_LABELS[type]}</span>
      </div>

      <div className="payment-info-row">
        <span className="payment-info-label">{t.dateInfoLabel}</span>
        <span className="payment-info-value">{formatDate(date)}</span>
      </div>

      <div className="payment-info-row">
        <span className="payment-info-label">{t.modeInfoLabel}</span>
        <span className="payment-info-value">{formatPaymentMode(mode)}</span>
      </div>

      {referenceNumber && (
        <div className="payment-info-row">
          <span className="payment-info-label">{t.referenceInfoLabel}</span>
          <span className="payment-info-value">{referenceNumber}</span>
        </div>
      )}

      {invoiceNumbers && (
        <div className="payment-info-row">
          <span className="payment-info-label">{t.invoicesWord}</span>
          <span className="payment-info-value">{invoiceNumbers}</span>
        </div>
      )}

      <div className="payment-info-row">
        <span className="payment-info-label">{t.amountInfoLabel}</span>
        <span className="payment-info-value tabular-nums">{formatPaise(amount)}</span>
      </div>

      {discount && (
        <div className="payment-info-row">
          <span className="payment-info-label">{t.discountInfoLabel}</span>
          <span className="payment-info-value payment-info-value--negative tabular-nums">
            −{formatPaise(discount.calculatedAmount)}
            {discount.reason && ` (${discount.reason})`}
          </span>
        </div>
      )}

      <div className="payment-info-row">
        <span className="payment-info-label">{t.unallocatedLabel}</span>
        <span className="payment-info-value tabular-nums">
          {unallocatedAmount > 0 ? formatPaise(unallocatedAmount) : t.fullyAllocatedLabel}
        </span>
      </div>

      {notes && (
        <div className="payment-info-row payment-info-row--stacked">
          <span className="payment-info-label">{t.notesInfoLabel}</span>
          <p className="payment-info-value">{notes}</p>
        </div>
      )}
    </div>
  )
}
