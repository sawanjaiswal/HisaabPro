/** Create Party — Business info section with GSTIN verification */

import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import type { PartyFormData } from '../party.types'
import type { UseGstinVerifyReturn } from '../useGstinVerify'

interface PartyFormBusinessProps {
  form: PartyFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
  gstinVerify: UseGstinVerifyReturn
}

export function PartyFormBusiness({ form, errors, onUpdate, gstinVerify }: PartyFormBusinessProps) {
  const { status, result, stateName } = gstinVerify

  return (
    <div className="create-party-section">
      <div>
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
          icon={status === 'validating' ? <Loader2 size={16} className="gstin-spinner" /> : undefined}
        />

        {status === 'idle' && (
          <p id="party-gstin-hint" className="gstin-hint">
            PAN will be auto-filled from GSTIN
          </p>
        )}

        {status === 'validating' && (
          <p className="gstin-hint gstin-hint--loading" aria-live="polite">
            Verifying GSTIN...
          </p>
        )}

        {status === 'verified' && result && (
          <div className="gstin-status gstin-status--verified" role="status" aria-live="polite">
            <CheckCircle size={14} aria-hidden="true" />
            <span>
              Verified{result.legalName ? ` — ${result.legalName}` : ''}
              {stateName ? ` (${stateName})` : ''}
            </span>
          </div>
        )}

        {status === 'failed' && result && (
          <div className="gstin-status gstin-status--failed" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{result.error ?? `GSTIN ${result.status ?? 'not found'}`}</span>
          </div>
        )}
      </div>

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
