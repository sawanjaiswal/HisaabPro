/** Dashboard — Starred contacts (who owes you)
 *
 * Figma: horizontal scroll of circular avatars with names below.
 * Shows top 5 parties with highest receivable outstanding.
 * Tapping navigates to party statement.
 */

import React from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { getFirstName, formatCompactAmount } from '../dashboard.utils'
import { PartyAvatar } from '../../../components/ui/PartyAvatar'
import type { TopDebtor } from '../dashboard.types'

interface TopDebtorsProps {
  debtors: TopDebtor[]
  onViewAll: () => void
  onDebtorClick: (partyId: string) => void
  onSendReminder: (debtor: TopDebtor) => void
}

export const TopDebtors: React.FC<TopDebtorsProps> = ({
  debtors,
  onViewAll,
  onDebtorClick,
}) => {
  if (debtors.length === 0) return null

  return (
    <div className="dashboard-starred">
      <div className="dashboard-section-header">
        <span className="dashboard-section-title">Who Owes You</span>
        <button
          className="dashboard-section-link"
          onClick={onViewAll}
          aria-label="View all outstanding receivables"
        >
          See All
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="dashboard-starred-scroll" role="list" aria-label="Top contacts">
        {/* Add button */}
        <div className="dashboard-starred-item" role="listitem">
          <button
            className="dashboard-starred-add"
            onClick={onViewAll}
            aria-label="Add starred contact"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
          <span className="dashboard-starred-name">Add</span>
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
