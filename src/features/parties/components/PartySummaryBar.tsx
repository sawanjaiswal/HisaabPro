/** Parties — Hero card pair (To Collect / To Pay)
 *
 * Matches dashboard OutstandingHero pattern: teal card (collect) + lime card (pay).
 * Amount left-aligned, label below with arrow, chevron on right.
 * All amounts in PAISE — formatted via paisaToRupees.
 */

import React from 'react'
import { ChevronRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { paisaToRupees } from '../party.utils'
import './PartySummaryBar.css'

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
  const { totalReceivable, totalPayable, totalParties } = summary

  return (
    <div className="party-hero" role="list" aria-label="Party outstanding summary">
      <p className="party-hero-count">{totalParties} Parties</p>

      <div className="party-hero-cards">
        {/* To Collect — teal gradient */}
        <button
          className="party-hero-card party-hero-card--collect"
          role="listitem"
          onClick={onCollectClick}
          aria-label={`To collect: Rs ${paisaToRupees(totalReceivable)} receivable`}
        >
          <div className="party-hero-card-content">
            <span className="party-hero-amount">
              <span className="party-hero-rupee">Rs </span>
              {paisaToRupees(totalReceivable)}
            </span>
            <span className="party-hero-label">
              To Collect
              <ArrowDownLeft size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="party-hero-chevron" />
        </button>

        {/* To Pay — lime */}
        <button
          className="party-hero-card party-hero-card--pay"
          role="listitem"
          onClick={onPayClick}
          aria-label={`To pay: Rs ${paisaToRupees(totalPayable)} payable`}
        >
          <div className="party-hero-card-content">
            <span className="party-hero-amount">
              <span className="party-hero-rupee">Rs </span>
              {paisaToRupees(totalPayable)}
            </span>
            <span className="party-hero-label">
              To Pay
              <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="party-hero-chevron party-hero-chevron--dark" />
        </button>
      </div>
    </div>
  )
}
