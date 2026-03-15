/** Dashboard — Starred contacts (who owes you)
 *
 * Figma: horizontal scroll of circular avatars with names below.
 * Shows top 5 parties with highest receivable outstanding.
 * Tapping navigates to party statement.
 */

import React from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { TopDebtor } from '../dashboard.types'

interface TopDebtorsProps {
  debtors: TopDebtor[]
  onViewAll: () => void
  onDebtorClick: (partyId: string) => void
  onSendReminder: (debtor: TopDebtor) => void
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

const AVATAR_COLORS = 5

export const TopDebtors: React.FC<TopDebtorsProps> = ({
  debtors,
  onViewAll,
  onDebtorClick,
}) => {
  if (debtors.length === 0) return null

  return (
    <div className="dashboard-starred">
      <div className="dashboard-section-header">
        <span className="dashboard-section-title">Starred</span>
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

        {debtors.map((debtor, index) => (
          <button
            key={debtor.partyId}
            className="dashboard-starred-item"
            role="listitem"
            onClick={() => onDebtorClick(debtor.partyId)}
            aria-label={`${debtor.name}`}
          >
            <div className={`dashboard-starred-avatar dashboard-starred-avatar--${index % AVATAR_COLORS}`}>
              {getInitials(debtor.name)}
            </div>
            <span className="dashboard-starred-name">{getFirstName(debtor.name)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
