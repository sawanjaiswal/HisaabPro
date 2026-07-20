/** Total Outstanding footer card — mockup v2.
 * Composes <Card>: doc icon tile · label + "N Parties" sub-line · net amount ·
 * chevron. Pure display; navigation target owned by the parent. */

import React from 'react'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatAmount } from '../party.utils'

interface PartyOutstandingCardProps {
  /** Net outstanding in paise. */
  netOutstanding: number
  totalParties: number
  onClick?: () => void
}

export const PartyOutstandingCard: React.FC<PartyOutstandingCardProps> = ({
  netOutstanding,
  totalParties,
  onClick,
}) => {
  const { t } = useLanguage()

  return (
    <Card
      className="party-outstanding-card"
      onClick={onClick}
      aria-label={`${t.totalOutstandingLabel}: ${formatAmount(netOutstanding)}`}
    >
      <span className="party-outstanding-icon" aria-hidden="true">
        <ClipboardList size={20} />
      </span>
      <span className="party-outstanding-info">
        <span className="party-outstanding-label">{t.totalOutstandingLabel}</span>
        <span className="party-outstanding-sub">
          {totalParties} {totalParties === 1 ? t.party : t.parties}
        </span>
      </span>
      <span className="party-outstanding-amount">{formatAmount(netOutstanding)}</span>
      {onClick && <ChevronRight size={18} aria-hidden="true" className="party-outstanding-chevron" />}
    </Card>
  )
}
