/** TDS/TCS Summary Cards
 *
 * Displays four metric cards: TDS collected, TCS collected,
 * total invoice value, and invoice count.
 * All amounts in paise via formatAmount().
 */

import React from 'react'
import { formatAmount } from '../report.utils'
import type { TdsTcsTotals } from '../report-tax.types'

interface TdsTcsSummaryCardsProps {
  totals: TdsTcsTotals
}

interface MetricCardProps {
  label: string
  value: string
  colorClass?: string
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, colorClass }) => (
  <div className="tds-tcs-metric-card">
    <span className="tds-tcs-metric-card__label">{label}</span>
    <span className={`tds-tcs-metric-card__value${colorClass ? ` ${colorClass}` : ''}`}>
      {value}
    </span>
  </div>
)

export const TdsTcsSummaryCards: React.FC<TdsTcsSummaryCardsProps> = ({ totals }) => {
  return (
    <div className="tds-tcs-summary-cards" role="region" aria-label="TDS/TCS summary totals">
      <MetricCard
        label="TDS Collected"
        value={formatAmount(totals.totalTdsAmount)}
        colorClass="tds-tcs-metric-card__value--tds"
      />
      <MetricCard
        label="TCS Collected"
        value={formatAmount(totals.totalTcsAmount)}
        colorClass="tds-tcs-metric-card__value--tcs"
      />
      <MetricCard
        label="Invoice Value"
        value={formatAmount(totals.totalInvoiceValue)}
      />
      <MetricCard
        label="Invoices"
        value={String(totals.invoiceCount)}
        colorClass="tds-tcs-metric-card__value--count"
      />
    </div>
  )
}
