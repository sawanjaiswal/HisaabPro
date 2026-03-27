import { useState } from 'react'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'
import type { VerificationItem, RecordCountData } from '../stock-verification.types'
import { NOTES_MAX } from '../stock-verification.constants'
import { formatDiscrepancy, getDiscrepancyColor } from '../stock-verification.utils'
import { useLanguage } from '@/hooks/useLanguage'

interface CountItemRowProps {
  item: VerificationItem
  onSave: (itemId: string, data: RecordCountData) => void
  disabled: boolean
}

export function CountItemRow({ item, onSave, disabled }: CountItemRowProps) {
  const { t } = useLanguage()
  const [qty, setQty] = useState(item.actualQuantity?.toString() ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [showNotes, setShowNotes] = useState(false)
  const unit = item.product?.unit?.symbol ?? 'pcs'
  const rawParsed = qty === '' ? null : parseFloat(qty)
  const parsed = rawParsed !== null && !Number.isNaN(rawParsed) ? rawParsed : null
  const discrepancy = parsed !== null ? parsed - item.expectedQuantity : null

  const handleSave = () => {
    if (parsed === null || parsed < 0) return
    onSave(item.id, { actualQuantity: parsed, ...(notes ? { notes } : {}) })
  }

  return (
    <div className="sv-count-row">
      <div className="sv-count-row__product">
        <span className="sv-count-row__name">{item.product?.name ?? 'Unknown'}</span>
        {item.product?.sku && <span className="sv-count-row__sku">{item.product.sku}</span>}
      </div>
      <div className="sv-count-row__fields">
        <div className="sv-count-row__expected">
          <span className="sv-count-row__label">{t.expectedLabel}</span>
          <span className="sv-count-row__value">{item.expectedQuantity} {unit}</span>
        </div>
        <div className="sv-count-row__input-group">
          <label htmlFor={`count-${item.id}`} className="sv-count-row__label">{t.actualLabel}</label>
          <input
            id={`count-${item.id}`}
            type="number"
            inputMode="decimal"
            min={0}
            className="sv-count-row__input"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            disabled={disabled}
          />
        </div>
        <div className="sv-count-row__diff">
          <span className="sv-count-row__label">{t.diffLabel}</span>
          <span className="sv-count-row__diff-value" style={{ color: getDiscrepancyColor(discrepancy) }}>
            {formatDiscrepancy(discrepancy)}
          </span>
        </div>
      </div>
      <div className="sv-count-row__actions">
        <button
          type="button"
          className="sv-count-row__notes-toggle"
          onClick={() => setShowNotes(!showNotes)}
          aria-label={showNotes ? t.hideNotes : t.addNotes}
          aria-expanded={showNotes}
        >
          {showNotes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {t.notesToggleBtn}
        </button>
        <button
          type="button"
          className="sv-count-row__save"
          onClick={handleSave}
          disabled={disabled || parsed === null || parsed < 0}
          aria-label={`Save count for ${item.product?.name ?? 'item'}`}
        >
          <Save size={14} aria-hidden="true" />
          {t.saveBtnLabel}
        </button>
      </div>
      {showNotes && (
        <textarea
          className="sv-count-row__notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.itemNotes}
          maxLength={NOTES_MAX}
          rows={2}
          disabled={disabled}
          aria-label={`Notes for ${item.product?.name ?? 'item'}`}
        />
      )}
    </div>
  )
}
