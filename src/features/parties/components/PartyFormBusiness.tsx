/** Create Party — Business info section with GSTIN verification */

import { Text } from '@/components/ui/Text'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatGSTIN, formatPAN } from '@/lib/format'
import type { PartyFormData } from '../party.types'
import type { UseGstinVerifyReturn } from '../useGstinVerify'
import { Textarea } from '@/components/ui/Textarea'

interface PartyFormBusinessProps {
  form: PartyFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
  gstinVerify: UseGstinVerifyReturn
}

export function PartyFormBusiness({ form, errors, onUpdate, gstinVerify }: PartyFormBusinessProps) {
  const { t } = useLanguage()
  const { status, result, stateName } = gstinVerify

  return (
    <div className="create-party-section py-0">
      <div>
        <Input
          label={t.gstin}
          id="party-gstin"
          value={form.gstin ?? ''}
          onChange={e => {
            const clean = e.target.value.toUpperCase().replace(/\s+/g, '').slice(0, 15)
            onUpdate('gstin', clean || undefined)
          }}
          onBlur={() => {
            if (form.gstin) {
              const formatted = formatGSTIN(form.gstin)
              if (formatted && formatted !== '—') onUpdate('gstin', formatted)
            }
          }}
          error={errors.gstin}
          placeholder="24AAACC1206D1ZM"
          maxLength={15}
          autoComplete="off"
          aria-describedby={errors.gstin ? 'party-gstin-error' : 'party-gstin-hint'}
          icon={status === 'validating' ? <Loader2 size={16} className="gstin-spinner" /> : undefined}
        />

        {status === 'idle' && (
          <Text id="party-gstin-hint" className="gstin-hint">
            {t.panAutoFilled}
          </Text>
        )}

        {status === 'validating' && (
          <Text className="gstin-hint gstin-hint--loading" aria-live="polite">
            {t.verifyingGstin}
          </Text>
        )}

        {status === 'verified' && result && (
          <div className="gstin-status gstin-status--verified" role="status" aria-live="polite">
            <CheckCircle size={14} aria-hidden="true" />
            <span>
              {t.verified}{result.legalName ? ` — ${result.legalName}` : ''}
              {stateName ? ` (${stateName})` : ''}
            </span>
          </div>
        )}

        {status === 'failed' && result && (
          <div className="gstin-status gstin-status--failed" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{result.error ?? `${t.gstin} ${result.status ?? t.gstinNotFound}`}</span>
          </div>
        )}
      </div>

      <Input
        label="PAN"
        id="party-pan"
        value={form.pan ?? ''}
        onChange={e => {
          const clean = e.target.value.toUpperCase().replace(/\s+/g, '').slice(0, 10)
          onUpdate('pan', clean || undefined)
        }}
        onBlur={() => {
          if (form.pan) {
            const formatted = formatPAN(form.pan)
            if (formatted && formatted !== '—') onUpdate('pan', formatted)
          }
        }}
        error={errors.pan}
        placeholder="AAACC1206D"
        maxLength={10}
        autoComplete="off"
        aria-label={t.panNumberLabel}
      />

      <div className="input-group">
        <label htmlFor="party-notes" className="input-label">{t.notesSection}</label>
        <Textarea
          id="party-notes"
          className="input input-textarea"
          value={form.notes ?? ''}
          onChange={e => onUpdate('notes', e.target.value || undefined)}
          placeholder={t.partyNotesPlaceholder}
          rows={3}
          aria-label={t.partyNotesLabel}
        />
      </div>
    </div>
  )
}
