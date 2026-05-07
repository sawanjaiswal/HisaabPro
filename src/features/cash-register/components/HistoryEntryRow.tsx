/** Cash Register — Single history entry row with badges and kebab actions */

import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { formatPaise } from '../cashRegister.utils'
import type { CashEntryDTO } from '../cashRegister.types'

interface Props {
  entry: CashEntryDTO
  onEdit: (id: string) => void
  onVoid: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  isOwner: boolean
}

export function HistoryEntryRow({ entry, onEdit, onVoid, onRestore, onDelete, isOwner }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  const isVoided = entry.voidedAt !== null
  const isEdited = entry.editCount > 0

  const toggleMenu = () => setMenuOpen((v) => !v)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div
      className={`cr-entry-row${isVoided ? ' cr-entry-row--voided' : ''}`}
      aria-label={`${entry.direction === 'IN' ? 'Cash In' : 'Cash Out'} ${formatPaise(entry.amountPaise)}`}
    >
      {/* Direction indicator */}
      <span
        className={`cr-entry-row__dir cr-entry-row__dir--${entry.direction.toLowerCase()}`}
        aria-label={entry.direction === 'IN' ? 'Cash In' : 'Cash Out'}
      >
        {entry.direction === 'IN' ? '↑' : '↓'}
      </span>

      {/* Main content */}
      <div className="cr-entry-row__content">
        <span className="cr-entry-row__expression" title={entry.expression}>
          {entry.expression.length > 24 ? `${entry.expression.slice(0, 24)}…` : entry.expression}
        </span>
        {entry.note && (
          <span className="cr-entry-row__note">{entry.note}</span>
        )}
        <div className="cr-entry-row__badges">
          {isEdited && (
            <span className="cr-entry-row__badge cr-entry-row__badge--edited">Edited</span>
          )}
          {isVoided && (
            <span className="cr-entry-row__badge cr-entry-row__badge--voided">Voided</span>
          )}
        </div>
      </div>

      {/* Amount */}
      <span className="cr-entry-row__amount">
        {formatPaise(entry.amountPaise)}
      </span>

      {/* Kebab menu */}
      <div className="cr-entry-row__menu-wrap">
        <button
          type="button"
          className="cr-entry-row__kebab"
          onClick={toggleMenu}
          aria-label="Entry actions"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <MoreVertical size={18} />
        </button>

        {menuOpen && (
          <>
            <div className="cr-entry-row__backdrop" onClick={closeMenu} aria-hidden="true" />
            <div className="cr-entry-row__menu" role="menu">
              {!isVoided && (
                <button type="button" role="menuitem" className="cr-entry-row__menu-item"
                  onClick={() => { onEdit(entry.id); closeMenu() }}>
                  Edit
                </button>
              )}
              {!isVoided && (
                <button type="button" role="menuitem" className="cr-entry-row__menu-item"
                  onClick={() => { onVoid(entry.id); closeMenu() }}>
                  Void
                </button>
              )}
              {isVoided && (
                <button type="button" role="menuitem" className="cr-entry-row__menu-item"
                  onClick={() => { onRestore(entry.id); closeMenu() }}>
                  Restore
                </button>
              )}
              {isVoided && isOwner && (
                <button type="button" role="menuitem"
                  className="cr-entry-row__menu-item cr-entry-row__menu-item--danger"
                  onClick={() => { onDelete(entry.id); closeMenu() }}>
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
