/** Dashboard — "Today's Business" hero card (Home 2 redesign).
 *
 * Dark teal card: label + window, today's sales, the change against yesterday,
 * a 30-day area chart, then the metric tiles. Every number comes from
 * /dashboard/home; all amounts in PAISE.
 */

import React from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { AreaChart } from '@/components/charts/AreaChart'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactAmount } from '../dashboard.utils'
import { buildMetricTiles } from '../dashboard-trend.utils'
import { DashboardMetricTiles } from './DashboardMetricTiles'
import type { DashboardTrend } from '../dashboard.types'
import '../dashboard-sales-hero.css'

interface DashboardSalesHeroProps {
  trend: DashboardTrend
}

export const DashboardSalesHero: React.FC<DashboardSalesHeroProps> = ({ trend }) => {
  const { t } = useLanguage()
  const { today, deltaPct } = trend.todayVsYesterday
  const up = (deltaPct ?? 0) >= 0

  return (
    <div className="dashboard-biz-hero">
      <div className="dashboard-biz-hero__top">
        <span className="dashboard-biz-hero__eyebrow">{t.todaysBusiness}</span>
        <span className="dashboard-biz-hero__period">{t.last30Days}</span>
      </div>

      <div className="dashboard-biz-hero__body">
        <div className="dashboard-biz-hero__figures">
          <span className="dashboard-biz-hero__amount">{formatCompactAmount(today)}</span>
          <span className="dashboard-biz-hero__sublabel">{t.totalSales}</span>

          {/* No trade yesterday means there is nothing to compare against —
              better no chip than a fabricated one. */}
          {deltaPct !== null && (
            <span className="dashboard-biz-hero__delta-row">
              <span className={`dashboard-biz-hero__delta ${up ? 'is-up' : 'is-down'}`}>
                {up
                  ? <ArrowUp size={13} strokeWidth={2.5} aria-hidden="true" />
                  : <ArrowDown size={13} strokeWidth={2.5} aria-hidden="true" />}
                {Math.abs(deltaPct)}%
              </span>
              <span className="dashboard-biz-hero__delta-note">{t.vsYesterday}</span>
            </span>
          )}
        </div>

        <AreaChart
          className="dashboard-biz-hero__chart"
          data={trend.sales.series}
          color="var(--color-success-400, #4ade80)"
          height={112}
        />
      </div>

      <DashboardMetricTiles tiles={buildMetricTiles(trend)} />
    </div>
  )
}
