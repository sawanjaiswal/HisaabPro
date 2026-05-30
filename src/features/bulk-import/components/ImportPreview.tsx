/** Import Preview — Review contacts before importing */

import { Check, X, AlertTriangle } from 'lucide-react'
import { PARTY_TYPE_LABELS } from '@/features/parties/party.constants'
import type { ImportedContact } from '../bulk-import.types'
import type { PartyType } from '@/lib/types/party.types'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

interface ImportPreviewProps {
  contacts: ImportedContact[]
  partyType: PartyType
  selectedCount: number
  totalValid: number
  onToggle: (id: string) => void
  onSelectAll: (selected: boolean) => void
  onTypeChange: (type: PartyType) => void
  onConfirm: () => void
  onBack: () => void
}

const PARTY_TYPES: PartyType[] = ['CUSTOMER', 'SUPPLIER', 'BOTH']

export function ImportPreview({
  contacts, partyType, selectedCount, totalValid,
  onToggle, onSelectAll, onTypeChange, onConfirm, onBack,
}: ImportPreviewProps) {
  const { t } = useLanguage()
  const invalidCount = contacts.filter((c) => c.error).length

  return (
    <div className="import-preview">
      {/* Type selector */}
      <div className="import-preview-type">
        <span className="import-preview-type-label">{t.importAs}:</span>
        <div className="pill-tabs" role="tablist">
          {PARTY_TYPES.map((t) => (
            <Button variant="none"
              key={t}
              type="button"
              role="tab"
              className={`pill-tab${partyType === t ? ' active' : ''}`}
              onClick={() => onTypeChange(t)}
              aria-selected={partyType === t}
            >
              {PARTY_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="import-preview-stats">
        <span>{t.xOfYSelected}</span>
        {invalidCount > 0 && (
          <span className="import-preview-invalid">
            <AlertTriangle size={14} aria-hidden="true" />
            {invalidCount} invalid
          </span>
        )}
        <Button
          type="button"
          variant="ghost" size="sm"
          onClick={() => onSelectAll(selectedCount < totalValid)}
        >
          {selectedCount === totalValid ? t.deselectAll : t.selectAll}
        </Button>
      </div>

      {/* Contact list */}
      <div className="import-preview-list" role="list" aria-label={t.contactsToImport}>
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className={`import-preview-row${contact.error ? ' import-preview-row-error' : ''}`}
            role="listitem"
          >
            {contact.error ? (
              <X size={18} className="import-preview-icon-error" aria-hidden="true" />
            ) : (
              <Button variant="none"
                type="button"
                className={`import-preview-check${contact.isSelected ? ' checked' : ''}`}
                onClick={() => onToggle(contact.id)}
                aria-label={`${contact.isSelected ? 'Deselect' : 'Select'} ${contact.name}`}
              >
                {contact.isSelected && <Check size={14} aria-hidden="true" />}
              </Button>
            )}

            <div className="import-preview-info">
              <span className="import-preview-name">{contact.name}</span>
              <span className="import-preview-phone">
                {contact.phone || t.noPhone}
                {contact.error && <span className="import-preview-error-text"> — {contact.error}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="import-preview-actions">
        <Button
          type="button"
          variant="primary" size="lg"
          onClick={onConfirm}
          disabled={selectedCount === 0}
        >
          Import {selectedCount} {selectedCount === 1 ? 'Party' : 'Parties'}
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
