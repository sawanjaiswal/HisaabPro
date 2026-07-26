/** Dashboard — Business Overview carousel (Home 2 redesign).
 *
 * Horizontal scroll-snap row of mini metric cards (label, amount, delta,
 * sparkline) with pager dots tracking scroll position. All amounts in PAISE.
 * Every card is real money the business moved over the last 30 days.
 */

import React, { useRef, useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { Sparkline } from '@/components/charts/Sparkline'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactAmount } from '../dashboard.utils'
import { buildOverviewCards } from '../dashboard-trend.utils'
import type { DashboardTrend } from '../dashboard.types'
import '../dashboard-overview-carousel.css'

interface BusinessOverviewCarouselProps {
  trend: DashboardTrend
}

export const BusinessOverviewCarousel: React.FC<BusinessOverviewCarouselProps> = ({ trend }) => {
  const { t } = useLanguage()
  const cards = buildOverviewCards(trend)
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const handleScroll = () => {
    const el = trackRef.current
    if (!el) return
    const cardW = el.scrollWidth / cards.length
    setActive(Math.round(el.scrollLeft / cardW))
  }

  return (
    <section className="dashboard-overview py-0">
      <div className="dashboard-overview__header">
        <h2 className="dashboard-section-title">{t.businessOverview}</h2>
        <span className="dashboard-overview__period">{t.last30Days}</span>
      </div>

      <div className="dashboard-overview__track" ref={trackRef} onScroll={handleScroll} role="list">
        {cards.map((card) => {
          const up = (card.deltaPct ?? 0) >= 0
          const color = card.positive
            ? 'var(--color-success-500)'
            : 'var(--color-error-500)'
          return (
            <div key={card.id} className="dashboard-overview__card" role="listitem">
              <span className="dashboard-overview__label">{t[card.labelKey]}</span>
              <span className="dashboard-overview__amount">{formatCompactAmount(card.amount)}</span>
              {card.deltaPct !== null && (
                <span className={`dashboard-overview__delta ${up ? 'is-up' : 'is-down'}`}>
                  {up ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
                  {Math.abs(card.deltaPct)}%
                </span>
              )}
              <Sparkline
                className="dashboard-overview__spark"
                data={card.series}
                color={color}
                width={130}
                height={36}
              />
            </div>
          )
        })}
      </div>

      <div className="dashboard-overview__dots" role="tablist" aria-label={t.businessOverview}>
        {cards.map((card, i) => (
          <span
            key={card.id}
            className={`dashboard-overview__dot ${i === active ? 'is-active' : ''}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  )
}
