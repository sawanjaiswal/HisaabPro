/** Invoice Report — "Total Sales / Total Purchases" hero card (mockup #15).
 *
 * Deep-emerald card carrying the headline total, the delta vs the previous
 * period, and the trend chart. Chart + up-delta use the BRIGHT success green
 * (never the dark brand emerald) so they read on the dark surface.
 */

import { ArrowDown, ArrowUp } from 'lucide-react'
import { AreaChart } from '@/components/charts/AreaChart'
import { useLanguage } from '@/hooks/useLanguage'
import { formatAmount } from '../report.utils'
import { periodDelta, trendLabels, trendValues } from '../invoice-report.utils'
import type { InvoiceReportTrend, InvoiceReportType } from '../report.types'

interface InvoiceReportHeroProps {
  type: InvoiceReportType
  /** Range total in paise */
  totalAmount: number
  trend?: InvoiceReportTrend
}

export function InvoiceReportHero({ type, totalAmount, trend }: InvoiceReportHeroProps) {
  const { t } = useLanguage()

  const label = type === 'sale' ? t.totalSales : t.totalPurchases
  const delta = periodDelta(totalAmount, trend?.previousTotal ?? 0)
  const series = trend?.series ?? []
  const values = trendValues(series)

  return (
    <div className="invoice-report-hero">
      <span className="invoice-report-hero__label">{label}</span>
      <span className="invoice-report-hero__amount">{formatAmount(totalAmount)}</span>

      {delta.comparable && (
        <span
          className={`invoice-report-hero__delta${delta.up ? '' : ' is-down'}`}
        >
          {delta.up ? (
            <ArrowUp size={13} strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <ArrowDown size={13} strokeWidth={2.5} aria-hidden="true" />
          )}
          {delta.percent}%
          <span className="invoice-report-hero__delta-note">{t.vsPreviousPeriod}</span>
        </span>
      )}

      {values.length >= 2 ? (
        <AreaChart
          className="invoice-report-hero__chart"
          data={values}
          color="var(--color-success-500)"
          xLabels={trendLabels(series)}
          height={110}
          showGrid
        />
      ) : (
        <span className="invoice-report-hero__no-trend">{t.noTrendData}</span>
      )}
    </div>
  )
}
