/** Parties — Hero card pair (To Collect / To Pay)
 *
 * Uses shared summary-hero CSS pattern.
 * All amounts in PAISE — formatted via paisaToRupees.
 */

import React from 'react'
import { ChevronRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { paisaToRupees } from '../party.utils'

interface PartySummaryBarProps {
  summary: {
    totalReceivable: number
    totalPayable: number
    netOutstanding: number
    totalParties: number
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
  const { totalReceivable, totalPayable, totalParties } = summary

  return (
    <div className="summary-hero" role="list" aria-label={t.outstandingSummary}>
      <p className="summary-hero-count">{totalParties} {totalParties === 1 ? t.party : t.parties}</p>

      <div className="summary-hero-cards">
        {/* To Collect — teal gradient */}
        <button
          className="summary-hero-card summary-hero-card--teal"
          role="listitem"
          onClick={onCollectClick}
          aria-label={`${t.toCollect}: ₹${paisaToRupees(totalReceivable)}`}
        >
          <div className="summary-hero-card-content">
            <span className="summary-hero-amount">
              <span className="summary-hero-rupee">₹</span>
              {paisaToRupees(totalReceivable)}
            </span>
            <span className="summary-hero-label">
              {t.toCollect}
              <ArrowDownLeft size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron" />
        </button>

        {/* To Pay — lime */}
        <button
          className="summary-hero-card summary-hero-card--lime"
          role="listitem"
          onClick={onPayClick}
          aria-label={`${t.toPay}: ₹${paisaToRupees(totalPayable)}`}
        >
          <div className="summary-hero-card-content">
            <span className="summary-hero-amount">
              <span className="summary-hero-rupee">₹</span>
              {paisaToRupees(totalPayable)}
            </span>
            <span className="summary-hero-label">
              {t.toPay}
              <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron summary-hero-chevron--dark" />
        </button>
      </div>
    </div>
  )
}
