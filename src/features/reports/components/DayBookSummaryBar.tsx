/** Day Book — Summary bar showing daily totals */

import { formatAmount } from '../report.utils'
import type { DayBookSummary } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

interface DayBookSummaryBarProps {
  summary: DayBookSummary
}

export function DayBookSummaryBar({summary }: DayBookSummaryBarProps) {
  const { t } = useLanguage()
    return (
    <div className="report-summary-bar" role="region" aria-label={t.dayTotals}>
      <div className="report-summary-item">
        <span className="report-summary-label">{t.sales}</span>
        <span className="report-summary-value report-summary-value--primary">
          {formatAmount(summary.totalSales.amount)}
        </span>
        <span className="report-summary-count">
          {summary.totalSales.count} txn
        </span>
      </div>
      <div className="report-summary-item">
        <span className="report-summary-label">{t.purchases}</span>
        <span className="report-summary-value">
          {formatAmount(summary.totalPurchases.amount)}
        </span>
        <span className="report-summary-count">
          {summary.totalPurchases.count} txn
        </span>
      </div>
      <div className="report-summary-item">
        <span className="report-summary-label">{t.payIn}</span>
        <span className="report-summary-value report-summary-value--positive">
          {formatAmount(summary.paymentsIn.amount)}
        </span>
        <span className="report-summary-count">
          {summary.paymentsIn.count} txn
        </span>
      </div>
      <div className="report-summary-item">
        <span className="report-summary-label">{t.payOut}</span>
        <span className="report-summary-value report-summary-value--negative">
          {formatAmount(summary.paymentsOut.amount)}
        </span>
        <span className="report-summary-count">
          {summary.paymentsOut.count} txn
        </span>
      </div>
      <div className="report-summary-item">
        <span className="report-summary-label">{t.netCash}</span>
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
