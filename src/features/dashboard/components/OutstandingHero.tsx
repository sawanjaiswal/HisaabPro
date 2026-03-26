/** Dashboard — Outstanding hero cards (To Collect / To Pay)
 *
 * Figma design: teal card (collect) + lime card (pay).
 * Amount left-aligned, label below with arrow, chevron on right.
 * All amounts in PAISE — formatted via formatCompactAmount.
 */

import React from 'react'
import { ChevronRight, ArrowDown, ArrowUp } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactAmount } from '../dashboard.utils'

interface OutstandingHeroProps {
  receivableTotal: number
  receivablePartyCount: number
  payableTotal: number
  payablePartyCount: number
  onCollectClick: () => void
  onPayClick: () => void
}

export const OutstandingHero: React.FC<OutstandingHeroProps> = ({
  receivableTotal,
  receivablePartyCount,
  payableTotal,
  payablePartyCount,
  onCollectClick,
  onPayClick,
}) => {
  const { t } = useLanguage()
  return (
    <div className="dashboard-hero" role="list" aria-label="Outstanding summary">
      {/* To Collect — teal */}
      <button
        className="dashboard-hero-card dashboard-hero-card--collect"
        role="listitem"
        onClick={onCollectClick}
        aria-label={`To collect: ${formatCompactAmount(receivableTotal)} from ${receivablePartyCount} parties`}
      >
        <div className="dashboard-hero-card-content">
          <span className="dashboard-hero-amount">{formatCompactAmount(receivableTotal)}</span>
          <span className="dashboard-hero-label">
            {t.toCollect}
            <ArrowDown size={14} aria-hidden="true" />
          </span>
        </div>
        <div className="dashboard-hero-chevron" aria-hidden="true">
          <div className="dashboard-hero-chevron-icon"><ChevronRight size={12} /></div>
        </div>
      </button>

      {/* To Pay — lime */}
      <button
        className="dashboard-hero-card dashboard-hero-card--pay"
        role="listitem"
        onClick={onPayClick}
        aria-label={`To pay: ${formatCompactAmount(payableTotal)} to ${payablePartyCount} parties`}
      >
        <div className="dashboard-hero-card-content">
          <span className="dashboard-hero-amount">{formatCompactAmount(payableTotal)}</span>
          <span className="dashboard-hero-label">
            {t.toPay}
            <ArrowUp size={14} aria-hidden="true" />
          </span>
        </div>
        <div className="dashboard-hero-chevron dashboard-hero-chevron--dark" aria-hidden="true">
          <div className="dashboard-hero-chevron-icon"><ChevronRight size={12} /></div>
        </div>
      </button>
    </div>
  )
}
