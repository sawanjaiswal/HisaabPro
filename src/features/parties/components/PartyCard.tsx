import React, { useRef, useCallback } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PartySummary, PartyType } from '../party.types'
import { formatOutstanding, getPartyRowStatus } from '../party.utils'
import { PartyAvatar } from '../../../components/ui/PartyAvatar'
import { OptOutChip } from '@/features/marketing/components/OptOutChip'

/** labelKey per party type — resolves via useLanguage() */
const TYPE_CHIP: Record<PartyType, 'customer' | 'supplier' | 'both' | 'staff'> = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  BOTH: 'both',
  STAFF: 'staff',
}

interface PartyCardProps {
  party: PartySummary
  onClick: (id: string) => void
  /** Fires on long-press (500ms hold) to enter bulk select mode */
  onLongPress?: (id: string) => void
  /** Whether this card is currently selected in bulk mode */
  isSelected?: boolean
  /** Whether bulk select mode is active */
  isBulkMode?: boolean
  /** Whether this party has opted out of marketing messages */
  isOptedOut?: boolean
}

const LONG_PRESS_MS = 500

export const PartyCard: React.FC<PartyCardProps> = ({
  party,
  onClick,
  onLongPress,
  isSelected = false,
  isBulkMode = false,
  isOptedOut = false,
}) => {
  const { t } = useLanguage()
  const { text: balanceText, isReceivable } = formatOutstanding(party.outstandingBalance)
  const rowStatus = getPartyRowStatus(party.outstandingBalance)

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
      aria-label={`${isBulkMode ? (isSelected ? t.deselectParty : t.selectParty) : t.viewDetailsFor} ${party.name}`}
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
        <PartyAvatar name={party.name} size="sm" className="txn-avatar" />
      )}

      <div className="txn-info">
        <div className="party-card-header">
          <span className="txn-name">{party.name}</span>
          {/* Type tag only for non-default types — Customer is the majority and
              is already filterable via the tabs, so tagging it is just noise. */}
          {party.type !== 'CUSTOMER' && (
            <span className={`party-card-type-chip party-card-type-chip--${party.type.toLowerCase()}`}>
              {t[TYPE_CHIP[party.type]]}
            </span>
          )}
          {party.priceList && (
            <span className="party-card-pl-chip">{party.priceList.name}</span>
          )}
          {isOptedOut && <OptOutChip />}
        </div>
      </div>

      <div className="party-card-right">
        <div className={`txn-amount ${isReceivable ? 'txn-amount-positive' : 'txn-amount-negative'}`}>
          {balanceText}
        </div>
        <div className={`party-card-status party-card-status--${rowStatus.tone}`}>
          {t[rowStatus.labelKey]}
        </div>
      </div>

      {!isBulkMode && (
        <ChevronRight size={18} aria-hidden="true" className="party-card-chevron" />
      )}
    </div>
  )
}
