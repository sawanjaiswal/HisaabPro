/** ParsedEntryPreview — editable confirmation card for a parsed voice entry. */

import { Button } from '@/components/ui/Button'
import { Select, SelectItem } from '@/components/ui/Select'
import { useLanguage } from '@/hooks/useLanguage'
import type { ParsedVoiceEntry, VoiceIntent, VoicePaymentMode } from '../voice.types'
import { Input } from '@/components/ui/Input'

const PAYMENT_MODES: VoicePaymentMode[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD']
const PAYMENT_LABELS: Record<VoicePaymentMode, string> = {
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', CARD: 'Card',
}

interface Props {
  draft: ParsedVoiceEntry
  onChange: (patch: Partial<ParsedVoiceEntry>) => void
  onConfirm: () => void
  onCancel: () => void
  saving: boolean
}

export function ParsedEntryPreview({ draft, onChange, onConfirm, onCancel, saving }: Props) {
  const { t } = useLanguage()
  const amountRupees = draft.amountPaise != null ? String(draft.amountPaise / 100) : ''
  const lowConfidence = draft.confidence < 0.6

  return (
    <div className="voice-preview">
      {lowConfidence && (
        <p className="voice-preview__warn" role="status">{t.voiceLowConfidence}</p>
      )}

      <div className="voice-preview__intent" role="group" aria-label={t.voiceIntentLabel}>
        {(['expense', 'income'] as VoiceIntent[]).map((it) => (
          <button
            key={it}
            type="button"
            className={`voice-intent-pill${draft.intent === it ? ' voice-intent-pill--active' : ''}`}
            aria-pressed={draft.intent === it}
            onClick={() => onChange({ intent: it })}
          >
            {it === 'expense' ? t.voiceIntentExpense : t.voiceIntentIncome}
          </button>
        ))}
      </div>

      <div className="voice-preview__field">
        <label className="voice-preview__label" htmlFor="voiceAmount">{t.amountRsLabel}</label>
        <Input
          id="voiceAmount" type="number" min="0.01" step="0.01" inputMode="decimal"
          className="voice-preview__input" placeholder="0.00" value={amountRupees}
          onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onChange({ amountPaise: Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null })
          }}
        />
      </div>

      {draft.intent === 'income' && (
        <div className="voice-preview__field">
          <label className="voice-preview__label" htmlFor="voiceCategory">{t.categoryLabel}</label>
          <Input
            id="voiceCategory" className="voice-preview__input" value={draft.category ?? ''}
            placeholder="e.g. Interest, Rental"
            onChange={(e) => onChange({ category: e.target.value || null })}
          />
        </div>
      )}

      <div className="voice-preview__field">
        <label className="voice-preview__label" htmlFor="voiceMode">{t.paymentModeLabel}</label>
        <Select
          value={draft.paymentMode}
          onValueChange={(v) => onChange({ paymentMode: v as VoicePaymentMode })}
          ariaLabel={t.paymentModeLabel}
        >
          {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{PAYMENT_LABELS[m]}</SelectItem>)}
        </Select>
      </div>

      <div className="voice-preview__field">
        <label className="voice-preview__label" htmlFor="voiceDate">{t.dateLabel}</label>
        <Input
          id="voiceDate" type="date" className="voice-preview__input" value={draft.dateISO}
          onChange={(e) => onChange({ dateISO: e.target.value })}
        />
      </div>

      <div className="voice-preview__field">
        <label className="voice-preview__label" htmlFor="voiceNotes">{t.notesOptional}</label>
        <Input
          id="voiceNotes" className="voice-preview__input" value={draft.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>

      <div className="voice-preview__actions">
        <Button variant="ghost" size="md" onClick={onCancel} disabled={saving}>{t.cancel ?? 'Cancel'}</Button>
        <Button
          variant="primary" size="md" loading={saving}
          disabled={draft.amountPaise == null}
          onClick={onConfirm}
        >
          {draft.intent === 'expense' ? t.recordExpense : t.recordIncome}
        </Button>
      </div>
    </div>
  )
}
