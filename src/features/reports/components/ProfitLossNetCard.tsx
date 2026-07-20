/** Profit & Loss — the Net Profit / Net Loss card (mockup #16).
 *
 * Deep-emerald surface carrying the headline figure, the delta vs the previous
 * period, and the per-day net-profit curve. Chart + up-delta use the BRIGHT
 * success green so they read on the dark surface (never the brand emerald).
 */

import { ArrowDown, ArrowUp } from 'lucide-react'
import { AreaChart } from '@/components/charts/AreaChart'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import { periodDelta, trendLabels, trendValues } from '../report-analytics.utils'
import type { ProfitLossTrend } from '../finance.types'

interface ProfitLossNetCardProps {
  /** Net profit in paise — negative means a loss */
  netProfit: number
  trend: ProfitLossTrend
}

export function ProfitLossNetCard({ netProfit, trend }: ProfitLossNetCardProps) {
  const { t } = useLanguage()

  const isProfit = netProfit >= 0
  const delta = periodDelta(netProfit, trend.previousNetProfit)
  const values = trendValues(trend.series)

  return (
    <div className="pl-net">
      <span className="pl-net__label">{isProfit ? t.netProfitLabel : t.netLossLabel}</span>
      <span className="pl-net__amount">{formatPaise(Math.abs(netProfit))}</span>

      {delta.comparable && (
        <span className={`pl-net__delta${delta.up ? '' : ' is-down'}`}>
          {delta.up ? (
            <ArrowUp size={13} strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <ArrowDown size={13} strokeWidth={2.5} aria-hidden="true" />
          )}
          {delta.percent}%
          <span className="pl-net__delta-note">{t.vsPreviousPeriod}</span>
        </span>
      )}

      {values.length >= 2 ? (
        <AreaChart
          className="pl-net__chart"
          data={values}
          color="var(--color-success-500)"
          xLabels={trendLabels(trend.series)}
          height={110}
          showGrid
        />
      ) : (
        <span className="pl-net__no-trend">{t.noTrendData}</span>
      )}
    </div>
  )
}
