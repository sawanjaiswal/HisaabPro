/** Dashboard — "Today's Business" hero card (Home 2 redesign).
 *
 * Dark teal card: label + period dropdown, big sales amount, delta chip,
 * area chart, then the 4 metric tiles. All amounts in PAISE.
 * PREVIEW: series/deltas/tiles come from mock data until the backend lands.
 */

import React, { useState } from 'react'
import { ArrowUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AreaChart } from '@/components/charts/AreaChart'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactAmount } from '../dashboard.utils'
import { DashboardMetricTiles } from './DashboardMetricTiles'
import {
  SALES_SERIES,
  SALES_TODAY_PAISE,
  SALES_DELTA_PCT,
  SALES_X_LABELS,
  METRIC_TILES,
} from '../dashboard-preview.mock'
import '../dashboard-sales-hero.css'

export const DashboardSalesHero: React.FC = () => {
  const { t } = useLanguage()
  const [period, setPeriod] = useState(t.thisMonth)

  return (
    <div className="dashboard-biz-hero">
      <div className="dashboard-biz-hero__top">
        <span className="dashboard-biz-hero__eyebrow">{t.todaysBusiness}</span>
        <Button
          variant="none"
          className="dashboard-biz-hero__period"
          onClick={() => setPeriod((p) => p)}
          aria-label={period}
        >
          {period}
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </div>

      <span className="dashboard-biz-hero__amount">{formatCompactAmount(SALES_TODAY_PAISE)}</span>
      <span className="dashboard-biz-hero__sublabel">{t.totalSales}</span>

      <span className="dashboard-biz-hero__delta">
        <ArrowUp size={13} aria-hidden="true" />
        {SALES_DELTA_PCT}%
        <span className="dashboard-biz-hero__delta-note">{t.vsYesterday}</span>
      </span>

      <AreaChart
        className="dashboard-biz-hero__chart"
        data={SALES_SERIES}
        color="var(--color-success-400, #4ade80)"
        xLabels={SALES_X_LABELS}
        height={130}
      />

      <DashboardMetricTiles tiles={METRIC_TILES} />
    </div>
  )
}
