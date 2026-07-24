/** Cash Register — Single history entry row with badges and kebab actions */

import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { formatPaise } from '../cashRegister.utils'
import type { CashEntryDTO } from '../cashRegister.types'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  entry: CashEntryDTO
  onEdit: (id: string) => void
  onVoid: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  isOwner: boolean
}

export function HistoryEntryRow({ entry, onEdit, onVoid, onRestore, onDelete, isOwner }: Props) {
  const { t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)

  const isVoided = entry.voidedAt !== null
  const isEdited = entry.editCount > 0
  const dirLabel = entry.direction === 'IN' ? t.cashRegButtonCashIn : t.cashRegButtonCashOut

  const toggleMenu = () => setMenuOpen((v) => !v)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div
      className={`cr-entry-row${isVoided ? ' cr-entry-row--voided' : ''}`}
      aria-label={`${dirLabel} ${formatPaise(entry.amountPaise)}`}
    >
      {/* Direction indicator */}
      <span
        className={`cr-entry-row__dir cr-entry-row__dir--${entry.direction.toLowerCase()}`}
        aria-label={dirLabel}
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
            <span className="cr-entry-row__badge cr-entry-row__badge--edited">{t.cashRegBadgeEdited}</span>
          )}
          {isVoided && (
            <span className="cr-entry-row__badge cr-entry-row__badge--voided">{t.cashRegBadgeVoided}</span>
          )}
        </div>
      </div>

      {/* Amount */}
      <span className="cr-entry-row__amount">
        {formatPaise(entry.amountPaise)}
      </span>

      {/* Kebab menu */}
      <div className="cr-entry-row__menu-wrap">
        <Button variant="none"
          type="button"
          className="cr-entry-row__kebab"
          onClick={toggleMenu}
          aria-label={t.cashRegEntryActionsAria}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <MoreVertical size={18} />
        </Button>

        {menuOpen && (
          <>
            <div className="cr-entry-row__backdrop" onClick={closeMenu} aria-hidden="true" />
            <div className="cr-entry-row__menu" role="menu">
              {!isVoided && (
                <Button variant="none" type="button" role="menuitem" className="cr-entry-row__menu-item"
                  onClick={() => { onEdit(entry.id); closeMenu() }}>
                  {t.edit}
                </Button>
              )}
              {!isVoided && (
                <Button variant="none" type="button" role="menuitem" className="cr-entry-row__menu-item"
                  onClick={() => { onVoid(entry.id); closeMenu() }}>
                  {t.cashRegMenuVoid}
                </Button>
              )}
              {isVoided && (
                <Button variant="none" type="button" role="menuitem" className="cr-entry-row__menu-item"
                  onClick={() => { onRestore(entry.id); closeMenu() }}>
                  {t.cashRegMenuRestore}
                </Button>
              )}
              {isVoided && isOwner && (
                <Button variant="none" type="button" role="menuitem"
                  className="cr-entry-row__menu-item cr-entry-row__menu-item--danger"
                  onClick={() => { onDelete(entry.id); closeMenu() }}>
                  {t.delete}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
