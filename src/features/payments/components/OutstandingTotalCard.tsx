/** Receivables — the total-outstanding card (mockup #17).
 *
 * One figure for the currently filtered direction, with the number of parties
 * behind it. Replaces the three-up Receivable / Payable / Net strip: two of
 * those figures were always for the direction the user was not looking at.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'

interface OutstandingTotalCardProps {
  label: string
  /** Amount in PAISE */
  totalPaise: number
  partyCount: number
}

export const OutstandingTotalCard: React.FC<OutstandingTotalCardProps> = ({
  label,
  totalPaise,
  partyCount,
}) => {
  const { t } = useLanguage()

  return (
    <section className="outstanding-total py-0" aria-label={label}>
      <span className="outstanding-total-label">{label}</span>
      <span className="outstanding-total-amount tabular-nums">
        {formatPaise(Math.abs(totalPaise))}
      </span>
      <span className="outstanding-total-meta">
        {t.fromLabel} {partyCount} {t.fromCustomersLabel}
      </span>
    </section>
  )
}
