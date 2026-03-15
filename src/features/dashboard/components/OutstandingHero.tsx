/** Dashboard — Outstanding hero cards (To Collect / To Pay)
 *
 * Figma design: teal gradient collect card + lime-yellow pay card.
 * ₹ shown separately at smaller size, amount large.
 * All amounts in PAISE — formatted via formatCompactAmount.
 */

import React from 'react'
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react'
import { formatCompactAmount } from '../dashboard.utils'

interface OutstandingHeroProps {
  receivableTotal: number
  receivablePartyCount: number
  payableTotal: number
  payablePartyCount: number
  onCollectClick: () => void
  onPayClick: () => void
}

/** Strip ₹ prefix from formatted amount so we can render ₹ separately */
function splitAmount(paise: number): { symbol: string; value: string } {
  const formatted = formatCompactAmount(paise)
  if (formatted.startsWith('₹')) {
    return { symbol: '₹', value: formatted.slice(1) }
  }
  return { symbol: '', value: formatted }
}

export const OutstandingHero: React.FC<OutstandingHeroProps> = ({
  receivableTotal,
  receivablePartyCount,
  payableTotal,
  payablePartyCount,
  onCollectClick,
  onPayClick,
}) => {
  const collect = splitAmount(receivableTotal)
  const pay = splitAmount(payableTotal)

  return (
    <div className="dashboard-hero" role="list" aria-label="Outstanding summary">
      <button
        className="dashboard-hero-card dashboard-hero-card--collect"
        role="listitem"
        onClick={onCollectClick}
        aria-label={`To collect: ${formatCompactAmount(receivableTotal)} from ${receivablePartyCount} parties`}
      >
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-amount-row">
            <span className="dashboard-hero-rupee">{collect.symbol}</span>
            <span className="dashboard-hero-amount">{collect.value}</span>
          </div>
          <div className="dashboard-hero-label-row">
            <span className="dashboard-hero-label">To Collect</span>
            <ArrowDown size={16} aria-hidden="true" />
          </div>
        </div>
        <div className="dashboard-hero-chevron">
          <ChevronRight size={16} aria-hidden="true" />
        </div>
      </button>

      <button
        className="dashboard-hero-card dashboard-hero-card--pay"
        role="listitem"
        onClick={onPayClick}
        aria-label={`To pay: ${formatCompactAmount(payableTotal)} to ${payablePartyCount} parties`}
      >
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-amount-row">
            <span className="dashboard-hero-rupee">{pay.symbol}</span>
            <span className="dashboard-hero-amount">{pay.value}</span>
          </div>
          <div className="dashboard-hero-label-row">
            <span className="dashboard-hero-label">To Pay</span>
            <ArrowUp size={16} aria-hidden="true" />
          </div>
        </div>
        <div className="dashboard-hero-chevron">
          <ChevronRight size={16} aria-hidden="true" />
        </div>
      </button>
    </div>
  )
}
