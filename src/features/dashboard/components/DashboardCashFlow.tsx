/** Dashboard — Cash flow strip
 *
 * Three-column row: Received (green), Paid (red), Net Cash Flow (green/red).
 * All amount props are in PAISE (integer). Formatted via formatCompactAmount.
 */

import React from 'react'
import { formatCompactAmount } from '../dashboard.utils'
import { DASHBOARD_CASHFLOW_LABELS } from '../dashboard.constants'

interface DashboardCashFlowProps {
  /** Total payments received in range — paise */
  received: number
  /** Total payments made in range — paise */
  paid: number
  /** Net cash flow (received − paid) — paise, can be negative */
  net: number
}

export const DashboardCashFlow: React.FC<DashboardCashFlowProps> = ({
  received,
  paid,
  net,
}) => {
  const netClass =
    net > 0
      ? 'dashboard-cashflow-amount dashboard-cashflow-amount--positive'
      : net < 0
        ? 'dashboard-cashflow-amount dashboard-cashflow-amount--negative'
        : 'dashboard-cashflow-amount dashboard-cashflow-amount--neutral'

  return (
    <div className="dashboard-cashflow" aria-label="Cash flow summary">

      <div className="dashboard-cashflow-item">
        <span className="dashboard-cashflow-label">
          {DASHBOARD_CASHFLOW_LABELS.received}
        </span>
        <span
          className="dashboard-cashflow-amount dashboard-cashflow-amount--positive"
          aria-label={`Received: ${formatCompactAmount(received)}`}
        >
          {formatCompactAmount(received)}
        </span>
      </div>

      <div className="dashboard-cashflow-item">
        <span className="dashboard-cashflow-label">
          {DASHBOARD_CASHFLOW_LABELS.paid}
        </span>
        <span
          className="dashboard-cashflow-amount dashboard-cashflow-amount--negative"
          aria-label={`Paid: ${formatCompactAmount(paid)}`}
        >
          {formatCompactAmount(paid)}
        </span>
      </div>

      <div className="dashboard-cashflow-item">
        <span className="dashboard-cashflow-label">
          {DASHBOARD_CASHFLOW_LABELS.netCashFlow}
        </span>
        <span
          className={netClass}
          aria-label={`Net cash flow: ${formatCompactAmount(Math.abs(net))}${net < 0 ? ' deficit' : ''}`}
        >
          {net < 0 ? '-' : ''}{formatCompactAmount(Math.abs(net))}
        </span>
      </div>

    </div>
  )
}
