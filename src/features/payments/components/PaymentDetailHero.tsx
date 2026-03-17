/** Payment Detail — Hero card sub-component
 *
 * Displays the payment type, party name, amount, date, and mode
 * in a colored hero card at the top of the detail page.
 */

import { PAYMENT_TYPE_LABELS } from '../payment.constants'
import { formatPaymentMode } from '../payment.utils'
import type { PaymentType, PaymentMode } from '../payment.types'

interface PaymentDetailHeroProps {
  type: PaymentType
  partyName: string
  /** Amount in PAISE */
  amount: number
  /** ISO date string */
  date: string
  mode: PaymentMode
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

export function PaymentDetailHero({ type, partyName, amount, date, mode }: PaymentDetailHeroProps) {
  return (
    <div className={`card-primary payment-hero ${type === 'PAYMENT_IN' ? 'payment-hero-in' : 'payment-hero-out'}`}>
      <span className="payment-hero-type">{PAYMENT_TYPE_LABELS[type]}</span>
      <span className="payment-hero-party">{partyName}</span>
      <span className="payment-hero-amount">{formatAmount(amount)}</span>
      <span className="payment-hero-date">
        {formatDate(date)} · {formatPaymentMode(mode)}
      </span>
    </div>
  )
}
