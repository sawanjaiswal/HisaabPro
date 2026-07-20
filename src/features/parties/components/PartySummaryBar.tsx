/** Parties — Hero card pair (To Collect / To Pay), mockup v2 layout:
 * circled arrow icon · label above amount · party-count sub-line · chevron.
 *
 * Uses shared summary-hero CSS pattern (v2 modifiers additive in
 * src/styles/summary-hero.css). All amounts in PAISE via paisaToRupees.
 */

import React from 'react'
import { ChevronRight, ArrowDown, ArrowUp } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { paisaToRupees } from '../party.utils'
import { Button } from '@/components/ui/Button'

interface PartySummaryBarProps {
  summary: {
    totalReceivable: number
    totalPayable: number
    netOutstanding: number
    totalParties: number
    customersCount?: number
    suppliersCount?: number
  }
  onCollectClick?: () => void
  onPayClick?: () => void
}

export const PartySummaryBar: React.FC<PartySummaryBarProps> = ({
  summary,
  onCollectClick,
  onPayClick,
}) => {
  const { t } = useLanguage()
  const { totalReceivable, totalPayable, customersCount, suppliersCount } = summary

  return (
    <div className="summary-hero" role="list" aria-label={t.outstandingSummary}>
      <div className="summary-hero-cards">
        {/* To Collect — emerald gradient */}
        <Button variant="none"
          className="summary-hero-card summary-hero-card--teal summary-hero-card--v2"
          role="listitem"
          onClick={onCollectClick}
          aria-label={`${t.toCollect}: ₹${paisaToRupees(totalReceivable)}`}
        >
          <span className="summary-hero-icon-ring" aria-hidden="true">
            <ArrowDown size={22} />
          </span>
          <span className="summary-hero-card-content">
            <span className="summary-hero-label">{t.toCollect}</span>
            <span className="summary-hero-amount">
              <span className="summary-hero-rupee">₹</span>
              {paisaToRupees(totalReceivable)}
            </span>
            {customersCount != null && (
              <span className="summary-hero-sub">
                {customersCount} {t.customers}
              </span>
            )}
          </span>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron" />
        </Button>

        {/* To Pay — lime */}
        <Button variant="none"
          className="summary-hero-card summary-hero-card--lime summary-hero-card--v2"
          role="listitem"
          onClick={onPayClick}
          aria-label={`${t.toPay}: ₹${paisaToRupees(totalPayable)}`}
        >
          <span className="summary-hero-icon-ring summary-hero-icon-ring--dark" aria-hidden="true">
            <ArrowUp size={22} />
          </span>
          <span className="summary-hero-card-content">
            <span className="summary-hero-label">{t.toPay}</span>
            <span className="summary-hero-amount">
              <span className="summary-hero-rupee">₹</span>
              {paisaToRupees(totalPayable)}
            </span>
            {suppliersCount != null && (
              <span className="summary-hero-sub">
                {suppliersCount} {t.suppliers}
              </span>
            )}
          </span>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron summary-hero-chevron--dark" />
        </Button>
      </div>
    </div>
  )
}
