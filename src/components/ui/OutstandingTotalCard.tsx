/** Outstanding-total footer card (mockups #4, #17, #66).
 *
 * Icon tile · label + "N parties" sub-line · net amount · optional chevron.
 * Pure display; the navigation target belongs to the caller.
 *
 * Promoted from `features/parties/components/PartyOutstandingCard` once the
 * aging report needed the identical card: sharing it from `features/parties/**`
 * would have meant importing that feature's whole stylesheet for two rules.
 */

import React from 'react'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatRupees } from '@/lib/format'
import './outstanding-total-card.css'

interface OutstandingTotalCardProps {
  /** Row label, e.g. "Total Outstanding". */
  label: string
  /** Net amount in paise. */
  totalPaise: number
  /** Sub-line under the label, e.g. "From 18 parties". */
  caption: string
  onClick?: () => void
}

export const OutstandingTotalCard: React.FC<OutstandingTotalCardProps> = ({
  label,
  totalPaise,
  caption,
  onClick,
}) => (
  <Card
    className="outstanding-total-card"
    onClick={onClick}
    aria-label={`${label}: ${formatRupees(totalPaise)}`}
  >
    <span className="outstanding-total-icon" aria-hidden="true">
      <ClipboardList size={20} />
    </span>
    <span className="outstanding-total-info">
      <span className="outstanding-total-label">{label}</span>
      <span className="outstanding-total-sub">{caption}</span>
    </span>
    <span className="outstanding-total-amount tabular-nums">{formatRupees(totalPaise)}</span>
    {onClick && (
      <ChevronRight size={18} aria-hidden="true" className="outstanding-total-chevron" />
    )}
  </Card>
)
