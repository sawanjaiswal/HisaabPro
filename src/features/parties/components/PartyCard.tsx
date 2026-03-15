import React from 'react'
import type { PartySummary } from '../party.types'
import { PARTY_TYPE_LABELS } from '../party.constants'
import { getInitials, getAvatarColor, formatOutstanding, formatPhone, timeAgo } from '../party.utils'

interface PartyCardProps {
  party: PartySummary
  onClick: (id: string) => void
}

export const PartyCard: React.FC<PartyCardProps> = ({ party, onClick }) => {
  const { text: balanceText, isReceivable } = formatOutstanding(party.outstandingBalance)
  const badgeClass = party.type === 'CUSTOMER'
    ? 'badge badge-customer'
    : party.type === 'SUPPLIER'
      ? 'badge badge-supplier'
      : 'badge'

  return (
    <div
      className="txn-row"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${party.name}`}
      onClick={() => onClick(party.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(party.id) }}
      style={{ minHeight: '44px', cursor: 'pointer' }}
    >
      <div
        className="txn-avatar avatar"
        style={{ backgroundColor: getAvatarColor(party.name) }}
        aria-hidden="true"
      >
        {getInitials(party.name)}
      </div>

      <div className="txn-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="txn-name">{party.name}</span>
          <span className={badgeClass}>{PARTY_TYPE_LABELS[party.type]}</span>
        </div>
        {party.phone && (
          <span className="txn-date">{formatPhone(party.phone)}</span>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className={`txn-amount ${isReceivable ? 'txn-amount-positive' : 'txn-amount-negative'}`}>
          {balanceText}
        </div>
        {party.lastTransactionAt && (
          <div className="txn-category">{timeAgo(party.lastTransactionAt)}</div>
        )}
      </div>
    </div>
  )
}
