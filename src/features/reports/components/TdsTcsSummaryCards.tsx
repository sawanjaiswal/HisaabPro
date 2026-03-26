/** TDS/TCS Summary Cards
 *
 * Displays four metric cards: TDS collected, TCS collected,
 * total invoice value, and invoice count.
 * All amounts in paise via formatAmount().
 */

import React from 'react'
import { formatAmount } from '../report.utils'
import type { TdsTcsTotals } from '../report-tax.types'
import { useLanguage } from '@/hooks/useLanguage'

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

export const TdsTcsSummaryCards: React.FC<TdsTcsSummaryCardsProps> = ({
  totals }) => {
  const { t } = useLanguage()
    return (
    <div className="tds-tcs-summary-cards" role="region" aria-label={t.tdsTcsSummaryTotals}>
      <MetricCard
        label={t.tdsCollected}
        value={formatAmount(totals.totalTdsAmount)}
        colorClass="tds-tcs-metric-card__value--tds"
      />
      <MetricCard
        label={t.tcsCollected}
        value={formatAmount(totals.totalTcsAmount)}
        colorClass="tds-tcs-metric-card__value--tcs"
      />
      <MetricCard
        label={t.invoiceValue}
        value={formatAmount(totals.totalInvoiceValue)}
      />
      <MetricCard
        label={t.invoices}
        value={String(totals.invoiceCount)}
        colorClass="tds-tcs-metric-card__value--count"
      />
    </div>
  )
}
