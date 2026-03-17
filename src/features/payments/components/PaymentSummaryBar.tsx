/** Payment list — Hero card pair (Money In / Money Out)
 *
 * Matches dashboard hero pattern: teal card (received) + lime card (paid out).
 * Net balance shown as subtitle above the cards.
 */

import React from 'react'
import { ChevronRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { PaymentListResponse } from '../payment.types'

interface PaymentSummaryBarProps {
  summary: PaymentListResponse['summary']
  onReceivedClick?: () => void
  onPaidClick?: () => void
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

export const PaymentSummaryBar: React.FC<PaymentSummaryBarProps> = ({
  summary,
  onReceivedClick,
  onPaidClick,
}) => {
  const { totalIn, totalOut, net } = summary

  return (
    <div className="payment-hero" role="list" aria-label="Payment summary">
      <p className="payment-hero-net">
        Net: <strong className={net >= 0 ? 'payment-hero-net--positive' : 'payment-hero-net--negative'}>
          {formatAmount(net)}
        </strong>
      </p>

      <div className="payment-hero-cards">
        {/* Money In — teal gradient */}
        <button
          className="payment-hero-card payment-hero-card--in"
          role="listitem"
          onClick={onReceivedClick}
          aria-label={`Money received: ${formatAmount(totalIn)}`}
        >
          <div className="payment-hero-card-content">
            <span className="payment-hero-amount">{formatAmount(totalIn)}</span>
            <span className="payment-hero-label">
              Money In
              <ArrowDownLeft size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="payment-hero-chevron" />
        </button>

        {/* Money Out — lime */}
        <button
          className="payment-hero-card payment-hero-card--out"
          role="listitem"
          onClick={onPaidClick}
          aria-label={`Money paid: ${formatAmount(totalOut)}`}
        >
          <div className="payment-hero-card-content">
            <span className="payment-hero-amount">{formatAmount(totalOut)}</span>
            <span className="payment-hero-label">
              Money Out
              <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="payment-hero-chevron payment-hero-chevron--dark" />
        </button>
      </div>
    </div>
  )
}
