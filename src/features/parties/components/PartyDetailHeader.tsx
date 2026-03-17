/** Party Detail — Hero header card with identity + outstanding balance */

import React from 'react'
import type { PartyDetail } from '../party.types'
import '../party-detail-header.css'
import { PARTY_TYPE_LABELS } from '../party.constants'
import {
  getInitials,
  getAvatarColor,
  formatOutstanding,
  formatPhone,
  formatAmount,
} from '../party.utils'

interface PartyDetailHeaderProps {
  party: PartyDetail
}

export const PartyDetailHeader: React.FC<PartyDetailHeaderProps> = ({ party }) => {
  const { text: balanceText, isReceivable } = formatOutstanding(party.outstandingBalance)

  const badgeClass =
    party.type === 'CUSTOMER'
      ? 'badge badge-customer'
      : party.type === 'SUPPLIER'
        ? 'badge badge-supplier'
        : 'badge'

  const balanceColor = isReceivable
    ? 'var(--color-success-500)'
    : 'var(--color-error-500)'

  const balanceLabel = isReceivable ? 'To Receive' : 'To Pay'

  return (
    <div className="card-primary party-detail-header" role="region" aria-label="Party overview">
      <div
        className="party-detail-avatar avatar"
        style={{ backgroundColor: getAvatarColor(party.name) }}
        aria-hidden="true"
      >
        {getInitials(party.name)}
      </div>

      <div className="party-detail-info">
        <h2 className="party-detail-name">{party.name}</h2>

        <div className="party-detail-meta">
          {party.phone && (
            <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>
              {formatPhone(party.phone)}
            </span>
          )}
          <span className={badgeClass} aria-label={`Party type: ${PARTY_TYPE_LABELS[party.type]}`}>
            {PARTY_TYPE_LABELS[party.type]}
          </span>
        </div>
      </div>

      <div className="party-detail-balance" aria-label={`Outstanding balance: ${balanceText}`}>
        <span className="money-hero" style={{ color: balanceColor }}>
          {balanceText}
        </span>
        <span className="money-label" style={{ opacity: 0.7 }}>{balanceLabel}</span>
        <span className="money-label" style={{ opacity: 0.55, marginTop: 'var(--space-1)' }}>
          Total business: {formatAmount(party.totalBusiness)}
        </span>
      </div>
    </div>
  )
}
