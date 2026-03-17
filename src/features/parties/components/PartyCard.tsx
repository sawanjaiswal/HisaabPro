import React, { useRef, useCallback } from 'react'
import { Check } from 'lucide-react'
import type { PartySummary } from '../party.types'
import { PARTY_TYPE_LABELS } from '../party.constants'
import { getInitials, getAvatarColor, formatOutstanding, formatPhone, timeAgo } from '../party.utils'

interface PartyCardProps {
  party: PartySummary
  onClick: (id: string) => void
  /** Fires on long-press (500ms hold) to enter bulk select mode */
  onLongPress?: (id: string) => void
  /** Whether this card is currently selected in bulk mode */
  isSelected?: boolean
  /** Whether bulk select mode is active */
  isBulkMode?: boolean
}

const LONG_PRESS_MS = 500

export const PartyCard: React.FC<PartyCardProps> = ({
  party,
  onClick,
  onLongPress,
  isSelected = false,
  isBulkMode = false,
}) => {
  const { text: balanceText, isReceivable } = formatOutstanding(party.outstandingBalance)
  const badgeClass = party.type === 'CUSTOMER'
    ? 'badge badge-customer'
    : party.type === 'SUPPLIER'
      ? 'badge badge-supplier'
      : 'badge'

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress(party.id)
    }, LONG_PRESS_MS)
  }, [onLongPress, party.id])

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleClick = useCallback(() => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    onClick(party.id)
  }, [onClick, party.id])

  return (
    <div
      className={`txn-row${isSelected ? ' txn-row--selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${isBulkMode ? (isSelected ? 'Deselect' : 'Select') : 'View details for'} ${party.name}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: 'pointer' }}
    >
      {isBulkMode ? (
        <div
          className={`bulk-check${isSelected ? ' bulk-check--active' : ''}`}
          aria-hidden="true"
        >
          {isSelected && <Check size={16} />}
        </div>
      ) : (
        <div
          className="txn-avatar avatar"
          style={{ backgroundColor: getAvatarColor(party.name) }}
          aria-hidden="true"
        >
          {getInitials(party.name)}
        </div>
      )}

      <div className="txn-info">
        <div className="party-card-header">
          <span className="txn-name">{party.name}</span>
          <span className={badgeClass}>{PARTY_TYPE_LABELS[party.type]}</span>
        </div>
        {party.phone && (
          <span className="txn-date">{formatPhone(party.phone)}</span>
        )}
      </div>

      <div className="party-card-right">
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
