/** Create Party — Business info section */

import { Input } from '@/components/ui/Input'
import type { PartyFormData } from '../party.types'

interface PartyFormBusinessProps {
  form: PartyFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
}

export function PartyFormBusiness({ form, errors, onUpdate }: PartyFormBusinessProps) {
  return (
    <div className="create-party-section">
      <Input
        label="GSTIN"
        id="party-gstin"
        value={form.gstin ?? ''}
        onChange={e => onUpdate('gstin', e.target.value.toUpperCase() || undefined)}
        error={errors.gstin}
        placeholder="24AAACC1206D1ZM"
        maxLength={15}
        autoComplete="off"
        aria-describedby={errors.gstin ? 'party-gstin-error' : 'party-gstin-hint'}
      />
      <p id="party-gstin-hint" className="input-error" style={{ color: 'var(--color-gray-400)' }}>
        PAN will be auto-filled from GSTIN
      </p>

      <Input
        label="PAN"
        id="party-pan"
        value={form.pan ?? ''}
        onChange={e => onUpdate('pan', e.target.value.toUpperCase() || undefined)}
        error={errors.pan}
        placeholder="AAACC1206D"
        maxLength={10}
        autoComplete="off"
        aria-label="PAN number (auto-filled from GSTIN)"
      />

      <div className="input-group">
        <label htmlFor="party-notes" className="input-label">Notes</label>
        <textarea
          id="party-notes"
          className="input create-party-textarea"
          value={form.notes ?? ''}
          onChange={e => onUpdate('notes', e.target.value || undefined)}
          placeholder="Any additional notes about this party..."
          rows={3}
          aria-label="Notes about this party"
        />
      </div>
    </div>
  )
}
