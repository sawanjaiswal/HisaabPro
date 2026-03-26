/** Payment list — Hero card pair (Money In / Money Out)
 *
 * Uses shared summary-hero CSS pattern.
 * Net balance shown as subtitle above the cards.
 */

import React from 'react'
import { ChevronRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
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
  const { t } = useLanguage()
  const { totalIn, totalOut, net } = summary

  return (
    <div className="summary-hero" role="list" aria-label={t.paymentSummary}>
      <p className="summary-hero-net">
        {t.net}: <strong className={net >= 0 ? 'summary-hero-net--positive' : 'summary-hero-net--negative'}>
          {formatAmount(net)}
        </strong>
      </p>

      <div className="summary-hero-cards">
        {/* Money In — teal gradient */}
        <button
          className="summary-hero-card summary-hero-card--teal"
          role="listitem"
          onClick={onReceivedClick}
          aria-label={`${t.moneyIn}: ${formatAmount(totalIn)}`}
        >
          <div className="summary-hero-card-content">
            <span className="summary-hero-amount">{formatAmount(totalIn)}</span>
            <span className="summary-hero-label">
              {t.moneyIn}
              <ArrowDownLeft size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron" />
        </button>

        {/* Money Out — lime */}
        <button
          className="summary-hero-card summary-hero-card--lime"
          role="listitem"
          onClick={onPaidClick}
          aria-label={`${t.moneyOut}: ${formatAmount(totalOut)}`}
        >
          <div className="summary-hero-card-content">
            <span className="summary-hero-amount">{formatAmount(totalOut)}</span>
            <span className="summary-hero-label">
              {t.moneyOut}
              <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron summary-hero-chevron--dark" />
        </button>
      </div>
    </div>
  )
}
