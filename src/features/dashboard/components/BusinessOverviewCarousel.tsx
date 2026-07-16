/** Dashboard — Business Overview carousel (Home 2 redesign).
 *
 * Horizontal scroll-snap row of mini metric cards (label, amount, delta,
 * sparkline) with pager dots tracking scroll position. All amounts in PAISE.
 * PREVIEW: cards come from mock data until the backend series endpoint lands.
 */

import React, { useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sparkline } from '@/components/charts/Sparkline'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactAmount } from '../dashboard.utils'
import { OVERVIEW_CARDS } from '../dashboard-preview.mock'
import '../dashboard-overview-carousel.css'

export const BusinessOverviewCarousel: React.FC = () => {
  const { t } = useLanguage()
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const handleScroll = () => {
    const el = trackRef.current
    if (!el) return
    const cardW = el.scrollWidth / OVERVIEW_CARDS.length
    setActive(Math.round(el.scrollLeft / cardW))
  }

  return (
    <section className="dashboard-overview py-0">
      <div className="dashboard-overview__header">
        <h2 className="dashboard-section-title">{t.businessOverview}</h2>
        <Button variant="none" className="dashboard-overview__period" aria-label={t.thisMonth}>
          {t.thisMonth}
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </div>

      <div className="dashboard-overview__track" ref={trackRef} onScroll={handleScroll} role="list">
        {OVERVIEW_CARDS.map((card) => {
          const up = card.deltaPct >= 0
          const color = card.positive
            ? 'var(--color-success-500)'
            : 'var(--color-error-500)'
          return (
            <div key={card.id} className="dashboard-overview__card" role="listitem">
              <span className="dashboard-overview__label">{t[card.labelKey]}</span>
              <span className="dashboard-overview__amount">{formatCompactAmount(card.amount)}</span>
              <span className={`dashboard-overview__delta ${up ? 'is-up' : 'is-down'}`}>
                {up ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
                {Math.abs(card.deltaPct)}%
              </span>
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
        {OVERVIEW_CARDS.map((card, i) => (
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
