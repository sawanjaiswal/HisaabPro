/** Dashboard — Starred contacts (who owes you)
 *
 * Figma: horizontal scroll of circular avatars with names below.
 * Shows top 5 parties with highest receivable outstanding.
 * Tapping navigates to party statement.
 */

import React from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { getFirstName, formatCompactAmount } from '../dashboard.utils'
import { PartyAvatar } from '../../../components/ui/PartyAvatar'
import type { TopDebtor } from '../dashboard.types'

interface TopDebtorsProps {
  debtors: TopDebtor[]
  totalOutstanding: number
  onViewAll: () => void
  onDebtorClick: (partyId: string) => void
}

export const TopDebtors: React.FC<TopDebtorsProps> = ({
  debtors,
  totalOutstanding,
  onViewAll,
  onDebtorClick,
}) => {
  const { t } = useLanguage()
  if (debtors.length === 0) return null

  return (
    <div className="dashboard-starred">
      <div className="dashboard-section-header py-0">
        <div className="dashboard-section-title-group py-0">
          <span className="dashboard-section-title py-0">{t.whoOwesYou}</span>
          <span className="dashboard-section-subtitle py-0">
            {debtors.length} {debtors.length === 1 ? t.party : t.parties} &middot; {formatCompactAmount(totalOutstanding)}
          </span>
        </div>
        <button
          className="dashboard-section-link py-0"
          onClick={onViewAll}
          aria-label={t.viewAllOutstanding}
        >
          {t.seeAll}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="dashboard-starred-scroll" role="list" aria-label={t.topContacts}>
        {/* Add button */}
        <div className="dashboard-starred-item" role="listitem">
          <button
            className="dashboard-starred-add"
            onClick={onViewAll}
            aria-label={t.addStarred}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
          <span className="dashboard-starred-name">{t.add}</span>
        </div>

        {debtors.map((debtor) => (
          <button
            key={debtor.partyId}
            className="dashboard-starred-item"
            role="listitem"
            onClick={() => onDebtorClick(debtor.partyId)}
            aria-label={`${debtor.name}`}
          >
            <PartyAvatar name={debtor.name} size="lg" className="dashboard-starred-avatar" />
            <span className="dashboard-starred-name">{getFirstName(debtor.name)}</span>
            <span className="dashboard-starred-amount">{formatCompactAmount(debtor.outstanding)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
