/** Payment list row — direction arrow + party name + amount + type badge */

import React, { useRef, useCallback } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react'
import type { PaymentSummary } from '../payment.types'
import { PAYMENT_TYPE_LABELS } from '../payment.constants'
import { formatPaymentMode } from '../payment.utils'

interface PaymentCardProps {
  payment: PaymentSummary
  onClick: (id: string) => void
  /** Fires on long-press (500ms hold) to enter bulk select mode */
  onLongPress?: (id: string) => void
  /** Whether this card is currently selected in bulk mode */
  isSelected?: boolean
  /** Whether bulk select mode is active */
  isBulkMode?: boolean
}

const LONG_PRESS_MS = 500

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

export const PaymentCard: React.FC<PaymentCardProps> = ({
  payment,
  onClick,
  onLongPress,
  isSelected = false,
  isBulkMode = false,
}) => {
  const isIn = payment.type === 'PAYMENT_IN'
  const arrowClass = isIn ? 'payment-card-arrow payment-card-arrow--in' : 'payment-card-arrow payment-card-arrow--out'
  const amountClass = isIn ? 'payment-card-amount payment-card-amount--in' : 'payment-card-amount payment-card-amount--out'
  const badgeClass = isIn ? 'payment-type-badge payment-type-badge--in' : 'payment-type-badge payment-type-badge--out'
  const typeLabel = PAYMENT_TYPE_LABELS[payment.type]
  const allocationLabel = payment.allocationsCount > 0
    ? `${payment.allocationsCount} invoice${payment.allocationsCount > 1 ? 's' : ''}`
    : 'Advance'

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress(payment.id)
    }, LONG_PRESS_MS)
  }, [onLongPress, payment.id])

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleClick = useCallback(() => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    onClick(payment.id)
  }, [onClick, payment.id])

  return (
    <div
      className={`payment-card${isSelected ? ' txn-row--selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${isBulkMode ? (isSelected ? 'Deselect' : 'Select') : 'View details for'} ${typeLabel} from ${payment.partyName}, ${formatAmount(payment.amount)}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {isBulkMode ? (
        <div
          className={`bulk-check${isSelected ? ' bulk-check--active' : ''}`}
          aria-hidden="true"
        >
          {isSelected && <Check size={16} />}
        </div>
      ) : (
        <div className={arrowClass} aria-hidden="true">
          {isIn
            ? <ArrowDownLeft size={20} />
            : <ArrowUpRight size={20} />
          }
        </div>
      )}

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
