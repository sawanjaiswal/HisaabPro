/** RevenueForecastCard (#146) — next-month projection + trend sparkline. */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { RevenueForecast } from '../analytics.types'
import { MiniLineChart } from './MiniLineChart'

interface RevenueForecastCardProps {
  forecast: RevenueForecast
}

export function RevenueForecastCard({ forecast }: RevenueForecastCardProps) {
  const { t } = useLanguage()
  const { momChangePct } = forecast

  const trend =
    momChangePct === null ? 'flat' : momChangePct > 0 ? 'up' : momChangePct < 0 ? 'down' : 'flat'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <Card className="analytics-card">
      <div className="analytics-card__head">
        <h2 className="analytics-card__title">{t.revenueForecast}</h2>
        <p className="analytics-card__subtitle">{t.revenueForecastDesc}</p>
      </div>

      <div className="analytics-card__metric">
        <div>
          <p className="analytics-card__metric-label">{t.nextMonthProjected}</p>
          <p className="analytics-card__metric-value tabular-nums">
            {formatPaise(forecast.nextMonthPaise)}
          </p>
        </div>
        {momChangePct !== null && (
          <span className={`analytics-trend analytics-trend--${trend}`}>
            <TrendIcon size={16} aria-hidden="true" />
            <span className="tabular-nums">{Math.abs(momChangePct).toFixed(1)}%</span>
          </span>
        )}
      </div>

      <MiniLineChart data={forecast.points} ariaLabel={t.revenueChartLabel} />

      <p className="analytics-card__disclaimer">{t.forecastDisclaimer}</p>
    </Card>
  )
}
