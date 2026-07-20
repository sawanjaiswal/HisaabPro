/** Receivables — the party rows, with long-press-to-bulk-select.
 *
 * Owns the long-press timer so OutstandingPage stays a composition of
 * sections. Bulk selection is receivable-only: you cannot chase a supplier
 * you owe money to.
 */

import React, { useRef } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { OutstandingCard } from './OutstandingCard'
import type { OutstandingParty } from '../payment.types'

const LONG_PRESS_MS = 500

interface OutstandingPartyListProps {
  parties: OutstandingParty[]
  isBulkActive: boolean
  isSelected: (partyId: string) => boolean
  onToggleSelect: (partyId: string) => void
  /** Opens the reminder drawer for this party. */
  onOpenParty: (partyId: string) => void
}

export const OutstandingPartyList: React.FC<OutstandingPartyListProps> = ({
  parties,
  isBulkActive,
  isSelected,
  onToggleSelect,
  onOpenParty,
}) => {
  const { t } = useLanguage()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  const startLongPress = (party: OutstandingParty) => {
    if (party.type !== 'RECEIVABLE') return
    didLongPressRef.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPressRef.current = true
      onToggleSelect(party.partyId)
    }, LONG_PRESS_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleClick = (party: OutstandingParty) => {
    // The long-press already toggled selection — don't also treat it as a tap.
    if (didLongPressRef.current) {
      didLongPressRef.current = false
      return
    }
    if (isBulkActive) {
      if (party.type === 'RECEIVABLE') onToggleSelect(party.partyId)
      return
    }
    onOpenParty(party.partyId)
  }

  return (
    <div className="outstanding-list stagger-list" role="list" aria-label={t.outstandingPartiesList}>
      {parties.map((party) => {
        const selected = isSelected(party.partyId)
        return (
          <div
            key={party.partyId}
            role="listitem"
            className={selected ? 'bulk-selected outstanding-list-item--selected' : 'outstanding-list-item'}
            onPointerDown={() => startLongPress(party)}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onClick={() => handleClick(party)}
            aria-selected={selected || undefined}
            style={{ cursor: 'pointer' }}
          >
            <OutstandingCard party={party} />
          </div>
        )
      })}
    </div>
  )
}
