/** RevenueForecastCard (#146) — next-month projection + trend sparkline. */

import { Text } from '@/components/ui/Text'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { RevenueForecast } from '../analytics.types'
import { MiniLineChart } from './MiniLineChart'
import { Heading } from '@/components/ui/Heading'

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
        <Heading level={2} className="analytics-card__title">{t.revenueForecast}</Heading>
        <Text className="analytics-card__subtitle">{t.revenueForecastDesc}</Text>
      </div>

      <div className="analytics-card__metric">
        <div>
          <Text className="analytics-card__metric-label">{t.nextMonthProjected}</Text>
          <Text className="analytics-card__metric-value tabular-nums">
            {formatPaise(forecast.nextMonthPaise)}
          </Text>
        </div>
        {momChangePct !== null && (
          <span className={`analytics-trend analytics-trend--${trend}`}>
            <TrendIcon size={16} aria-hidden="true" />
            <span className="tabular-nums">{Math.abs(momChangePct).toFixed(1)}%</span>
          </span>
        )}
      </div>

      <MiniLineChart data={forecast.points} ariaLabel={t.revenueChartLabel} />

      <Text className="analytics-card__disclaimer">{t.forecastDisclaimer}</Text>
    </Card>
  )
}
