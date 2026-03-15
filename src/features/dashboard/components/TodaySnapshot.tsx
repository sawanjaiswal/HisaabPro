/** Dashboard — Today's numbers strip
 *
 * Three-column compact strip: Sales | Received | Net
 * Always shows TODAY — no date filter.
 * All amounts in PAISE.
 */

import React from 'react'
import { formatCompactAmount } from '../dashboard.utils'
import { TODAY_LABELS } from '../dashboard.constants'

interface TodaySnapshotProps {
  salesAmount: number
  salesCount: number
  receivedAmount: number
  receivedCount: number
  netCashFlow: number
}

export const TodaySnapshot: React.FC<TodaySnapshotProps> = ({
  salesAmount,
  salesCount,
  receivedAmount,
  receivedCount,
  netCashFlow,
}) => {
  const netClass = netCashFlow > 0
    ? 'dashboard-today-amount dashboard-today-amount--positive'
    : netCashFlow < 0
      ? 'dashboard-today-amount dashboard-today-amount--negative'
      : 'dashboard-today-amount dashboard-today-amount--neutral'

  return (
    <div className="dashboard-today" aria-label="Today's numbers">
      <div className="dashboard-today-item">
        <span className="dashboard-today-label">{TODAY_LABELS.sales}</span>
        <span className="dashboard-today-amount">
          {formatCompactAmount(salesAmount)}
        </span>
        <span className="dashboard-today-sub">
          {salesCount} {salesCount === 1 ? 'inv' : 'inv'}
        </span>
      </div>

      <div className="dashboard-today-item">
        <span className="dashboard-today-label">{TODAY_LABELS.received}</span>
        <span className="dashboard-today-amount dashboard-today-amount--positive">
          {formatCompactAmount(receivedAmount)}
        </span>
        <span className="dashboard-today-sub">
          {receivedCount} {receivedCount === 1 ? 'pymt' : 'pymt'}
        </span>
      </div>

      <div className="dashboard-today-item">
        <span className="dashboard-today-label">{TODAY_LABELS.net}</span>
        <span className={netClass}>
          {netCashFlow < 0 ? '-' : ''}{formatCompactAmount(Math.abs(netCashFlow))}
        </span>
        <span className="dashboard-today-sub">cash</span>
      </div>
    </div>
  )
}
