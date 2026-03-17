/** Day Book — Summary bar showing daily totals */

import { formatAmount } from '../report.utils'
import type { DayBookSummary } from '../report.types'

interface DayBookSummaryBarProps {
  summary: DayBookSummary
}

export function DayBookSummaryBar({ summary }: DayBookSummaryBarProps) {
  return (
    <div className="report-summary-bar" role="region" aria-label="Day totals">
      <div className="report-summary-item">
        <span className="report-summary-label">Sales</span>
        <span className="report-summary-value report-summary-value--primary">
          {formatAmount(summary.totalSales.amount)}
        </span>
        <span className="report-summary-count">
          {summary.totalSales.count} txn
        </span>
      </div>
      <div className="report-summary-item">
        <span className="report-summary-label">Purchases</span>
        <span className="report-summary-value">
          {formatAmount(summary.totalPurchases.amount)}
        </span>
        <span className="report-summary-count">
          {summary.totalPurchases.count} txn
        </span>
      </div>
      <div className="report-summary-item">
        <span className="report-summary-label">Pay In</span>
        <span className="report-summary-value report-summary-value--positive">
          {formatAmount(summary.paymentsIn.amount)}
        </span>
        <span className="report-summary-count">
          {summary.paymentsIn.count} txn
        </span>
      </div>
      <div className="report-summary-item">
        <span className="report-summary-label">Pay Out</span>
        <span className="report-summary-value report-summary-value--negative">
          {formatAmount(summary.paymentsOut.amount)}
        </span>
        <span className="report-summary-count">
          {summary.paymentsOut.count} txn
        </span>
      </div>
      <div className="report-summary-item">
        <span className="report-summary-label">Net Cash</span>
        <span
          className={
            summary.netCashFlow >= 0
              ? 'report-summary-value report-summary-value--positive'
              : 'report-summary-value report-summary-value--negative'
          }
        >
          {formatAmount(summary.netCashFlow)}
        </span>
      </div>
    </div>
  )
}
