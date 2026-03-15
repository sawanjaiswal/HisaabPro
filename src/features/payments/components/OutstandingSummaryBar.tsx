/** Outstanding — three horizontal scroll summary cards: Receivable, Payable, Net */

import React from 'react'
import type { OutstandingTotals } from '../payment.types'

interface OutstandingSummaryBarProps {
  totals: OutstandingTotals
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(Math.abs(paise) / 100)
}

export const OutstandingSummaryBar: React.FC<OutstandingSummaryBarProps> = ({ totals }) => {
  const { totalReceivable, totalPayable, net } = totals
  const isNetPositive = net >= 0

  return (
    <div className="outstanding-summary-cards" aria-label="Outstanding summary">
      <div
        className="outstanding-summary-card"
        aria-label={`Total receivable: ${formatAmount(totalReceivable)}`}
      >
        <span className="outstanding-summary-card-label">Receivable</span>
        <span className="outstanding-summary-card-amount outstanding-summary-card-amount--receivable">
          {formatAmount(totalReceivable)}
        </span>
      </div>

      <div
        className="outstanding-summary-card"
        aria-label={`Total payable: ${formatAmount(totalPayable)}`}
      >
        <span className="outstanding-summary-card-label">Payable</span>
        <span className="outstanding-summary-card-amount outstanding-summary-card-amount--payable">
          {formatAmount(totalPayable)}
        </span>
      </div>

      <div
        className="outstanding-summary-card outstanding-summary-card--net"
        aria-label={`Net outstanding: ${isNetPositive ? '+' : '-'}${formatAmount(net)}`}
      >
        <span className="outstanding-summary-card-label">Net</span>
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
