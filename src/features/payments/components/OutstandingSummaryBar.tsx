/** Outstanding — three horizontal scroll summary cards: Receivable, Payable, Net */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { OutstandingTotals } from '../payment.types'

interface OutstandingSummaryBarProps {
  totals: OutstandingTotals
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(Math.abs(paise) / 100)
}

export const OutstandingSummaryBar: React.FC<OutstandingSummaryBarProps> = ({ totals }) => {
  const { t } = useLanguage()
  const { totalReceivable, totalPayable, net } = totals
  const isNetPositive = net >= 0

  return (
    <div className="outstanding-summary-cards" aria-label={t.outstandingSummary}>
      <div
        className="outstanding-summary-card"
        aria-label={`${t.receivable}: ${formatAmount(totalReceivable)}`}
      >
        <span className="outstanding-summary-card-label">{t.receivable}</span>
        <span className="outstanding-summary-card-amount outstanding-summary-card-amount--receivable">
          {formatAmount(totalReceivable)}
        </span>
      </div>

      <div
        className="outstanding-summary-card"
        aria-label={`${t.payable}: ${formatAmount(totalPayable)}`}
      >
        <span className="outstanding-summary-card-label">{t.payable}</span>
        <span className="outstanding-summary-card-amount outstanding-summary-card-amount--payable">
          {formatAmount(totalPayable)}
        </span>
      </div>

      <div
        className="outstanding-summary-card outstanding-summary-card--net"
        aria-label={`${t.net}: ${isNetPositive ? '+' : '-'}${formatAmount(net)}`}
      >
        <span className="outstanding-summary-card-label">{t.net}</span>
        <span
          className={
            isNetPositive
              ? 'outstanding-summary-card-amount outstanding-summary-card-amount--receivable'
              : 'outstanding-summary-card-amount outstanding-summary-card-amount--payable'
          }
        >
          {isNetPositive ? '+' : '-'}{formatAmount(net)}
        </span>
      </div>
    </div>
  )
}
