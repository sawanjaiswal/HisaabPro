/** Payment list row — direction arrow + party name + amount + type badge */

import React from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { PaymentSummary } from '../payment.types'
import { PAYMENT_TYPE_LABELS } from '../payment.constants'
import { formatPaymentMode } from '../payment.utils'

interface PaymentCardProps {
  payment: PaymentSummary
  onClick: (id: string) => void
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const PaymentCard: React.FC<PaymentCardProps> = ({ payment, onClick }) => {
  const isIn = payment.type === 'PAYMENT_IN'
  const arrowClass = isIn ? 'payment-card-arrow payment-card-arrow--in' : 'payment-card-arrow payment-card-arrow--out'
  const amountClass = isIn ? 'payment-card-amount payment-card-amount--in' : 'payment-card-amount payment-card-amount--out'
  const badgeClass = isIn ? 'payment-type-badge payment-type-badge--in' : 'payment-type-badge payment-type-badge--out'
  const typeLabel = PAYMENT_TYPE_LABELS[payment.type]
  const allocationLabel = payment.allocationsCount > 0
    ? `${payment.allocationsCount} invoice${payment.allocationsCount > 1 ? 's' : ''}`
    : 'Advance'

  return (
    <div
      className="payment-card"
      role="button"
      tabIndex={0}
      aria-label={`${typeLabel} from ${payment.partyName}, ${formatAmount(payment.amount)}`}
      onClick={() => onClick(payment.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(payment.id)
      }}
      style={{ minHeight: '44px', cursor: 'pointer' }}
    >
      <div className={arrowClass} aria-hidden="true">
        {isIn
          ? <ArrowDownLeft size={20} />
          : <ArrowUpRight size={20} />
        }
      </div>

      <div className="payment-card-content">
        <div className="payment-card-party">{payment.partyName}</div>
        <div className="payment-card-meta">
          <span className="payment-card-mode">{formatPaymentMode(payment.mode)}</span>
          <span className="payment-card-date">{formatDate(payment.date)}</span>
          <span className="payment-card-invoices">{allocationLabel}</span>
        </div>
      </div>

      <div className="payment-card-right">
        <span className={amountClass}>{formatAmount(payment.amount)}</span>
        <span
          className={badgeClass}
          aria-label={`Payment type: ${typeLabel}`}
        >
          {typeLabel}
        </span>
      </div>
    </div>
  )
}
