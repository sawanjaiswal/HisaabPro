/** StockForecastList (#146) — products ranked by soonest projected stock-out. */

import { AlertTriangle, Package } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { formatNumber } from '@/lib/format'
import type { StockForecastItem } from '../analytics.types'

interface StockForecastListProps {
  items: StockForecastItem[]
}

export function StockForecastList({ items }: StockForecastListProps) {
  const { t } = useLanguage()

  return (
    <Card className="analytics-card">
      <div className="analytics-card__head">
        <h2 className="analytics-card__title">{t.stockForecast}</h2>
        <p className="analytics-card__subtitle">{t.stockForecastDesc}</p>
      </div>

      <ul className="stock-forecast-list stagger-list">
        {items.map((item) => (
          <li key={item.productId} className="stock-forecast-row">
            <div className="stock-forecast-row__main">
              <span className="stock-forecast-row__name">{item.name}</span>
              <span className="stock-forecast-row__meta tabular-nums">
                {formatNumber(item.currentStock)} {t.inStock} · {item.dailyVelocity}
                {t.perDay}
              </span>
            </div>
            <div className="stock-forecast-row__side">
              {item.daysToStockOut === null ? (
                <span className="stock-forecast-row__safe">{t.noStockOutRisk}</span>
              ) : (
                <>
                  <span
                    className={`stock-forecast-row__days tabular-nums${
                      item.reorderSoon ? ' stock-forecast-row__days--urgent' : ''
                    }`}
                  >
                    {item.daysToStockOut} {t.daysLeft}
                  </span>
                  {item.reorderSoon && (
                    <span className="stock-forecast-row__badge">
                      <AlertTriangle size={12} aria-hidden="true" />
                      {t.reorderSoon}
                    </span>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <EmptyState
          icon={<Package size={22} aria-hidden="true" />}
          title={t.noStockForecastData}
        />
      )}
    </Card>
  )
}
