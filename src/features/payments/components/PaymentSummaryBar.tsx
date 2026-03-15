/** Payment list — three-metric summary bar: Received, Paid, Net */

import React from 'react'
import type { PaymentListResponse } from '../payment.types'

interface PaymentSummaryBarProps {
  summary: PaymentListResponse['summary']
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

export const PaymentSummaryBar: React.FC<PaymentSummaryBarProps> = ({ summary }) => {
  const { totalIn, totalOut, net } = summary
  const netAmountClass = net >= 0
    ? 'payment-summary-amount payment-summary-amount--received'
    : 'payment-summary-amount payment-summary-amount--paid'

  return (
    <div className="payment-summary-bar" aria-label="Payment summary">
      <div className="payment-summary-item">
        <span className="payment-summary-label">Received</span>
        <span className="payment-summary-amount payment-summary-amount--received">
          {formatAmount(totalIn)}
        </span>
      </div>

      <div className="payment-summary-item">
        <span className="payment-summary-label">Paid Out</span>
        <span className="payment-summary-amount payment-summary-amount--paid">
          {formatAmount(totalOut)}
        </span>
      </div>

      <div className="payment-summary-item">
        <span className="payment-summary-label">Net</span>
        <span
          className={netAmountClass}
          aria-label={`Net: ${formatAmount(net)}`}
        >
          {formatAmount(net)}
        </span>
      </div>
    </div>
  )
}
