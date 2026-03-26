/** Party Detail — Hero header card with identity + outstanding balance */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PartyDetail } from '../party.types'
import '../party-detail-header.css'
import { PARTY_TYPE_LABELS } from '../party.constants'
import {
  formatOutstanding,
  formatPhone,
  formatAmount,
} from '../party.utils'
import { PartyAvatar } from '../../../components/ui/PartyAvatar'

interface PartyDetailHeaderProps {
  party: PartyDetail
}

export const PartyDetailHeader: React.FC<PartyDetailHeaderProps> = ({ party }) => {
  const { t } = useLanguage()
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

  const balanceLabel = isReceivable ? t.toReceive : t.toPay

  return (
    <div className="card-primary party-detail-header" role="region" aria-label={t.partyOverview}>
      <PartyAvatar name={party.name} size="lg" className="party-detail-avatar" />

      <div className="party-detail-info">
        <h2 className="party-detail-name">{party.name}</h2>

        <div className="party-detail-meta">
          {party.phone && (
            <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>
              {formatPhone(party.phone)}
            </span>
          )}
          <span className={badgeClass} aria-label={`${t.partyTypeColon} ${PARTY_TYPE_LABELS[party.type]}`}>
            {PARTY_TYPE_LABELS[party.type]}
          </span>
        </div>
      </div>

      <div className="party-detail-balance" aria-label={`${t.outstandingBalanceColon} ${balanceText}`}>
        <span className="money-hero" style={{ color: balanceColor }}>
          {balanceText}
        </span>
        <span className="money-label" style={{ opacity: 0.7 }}>{balanceLabel}</span>
        <span className="money-label" style={{ opacity: 0.55, marginTop: 'var(--space-1)' }}>
          {t.totalBusiness} {formatAmount(party.totalBusiness)}
        </span>
      </div>
    </div>
  )
}
