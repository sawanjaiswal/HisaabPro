/**
 * GST Settings — form fields component
 *
 * All the editable fields below the master gate toggle.
 * Props are passed from GstSettingsPage.
 */

import { CheckCircle, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Select, SelectItem } from '@/components/ui/Select'
import { INDIAN_STATES } from '@/features/tax/tax.constants'
import type { CompositionRate, TaxPricingMode } from './gst.types'
import type { GstFormState, GstinValidation } from './useGstSettingsForm'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface GstFormFieldsProps {
  form: GstFormState
  gstinValidation: GstinValidation
  businessStateCode: string | null
  isSaving: boolean
  onPatch: <K extends keyof GstFormState>(key: K, value: GstFormState[K]) => void
  onGstinBlur: () => void
  compositionRates: CompositionRate[]
  rateLabel: (r: CompositionRate) => string
}

const PRICING_MODES: TaxPricingMode[] = ['EXCLUSIVE', 'INCLUSIVE']

export function GstFormFields({
  form, gstinValidation, businessStateCode, isSaving,
  onPatch, onGstinBlur, compositionRates, rateLabel,
}: GstFormFieldsProps) {
  const { t } = useLanguage()

  const stateName = gstinValidation.stateCode
    ? (INDIAN_STATES[gstinValidation.stateCode] ?? gstinValidation.stateCode)
    : null

  const stateCodeMismatch =
    gstinValidation.valid === true &&
    gstinValidation.stateCode !== null &&
    businessStateCode !== null &&
    gstinValidation.stateCode !== businessStateCode

  const decLen = form.gstDeclarationText.length
  const decWarn = decLen > 450

  return (
    <>
      {/* GSTIN input */}
      <div className="gsv2-field">
        <label className="gsv2-label" htmlFor="gsv2-gstin">{t.gstin}</label>
        <Input
          id="gsv2-gstin"
          className={[
            'gsv2-input',
            gstinValidation.valid === false ? 'gsv2-input--error' : '',
            gstinValidation.valid === true  ? 'gsv2-input--valid' : '',
          ].join(' ')}
          type="text"
          value={form.gstin}
          maxLength={15}
          placeholder="e.g. 29ABCDE1234F1Z5"
          autoCapitalize="characters"
          spellCheck={false}
          onChange={e => onPatch('gstin', e.target.value.toUpperCase())}
          onBlur={onGstinBlur}
          aria-describedby="gsv2-gstin-hint"
          disabled={isSaving}
        />
        {gstinValidation.valid === false && (
          <span id="gsv2-gstin-hint" className="gsv2-error-text" role="alert">
            {gstinValidation.error}
          </span>
        )}
        {gstinValidation.valid === true && stateName && (
          <span id="gsv2-gstin-hint" className="gsv2-valid-text">
            <CheckCircle size={12} aria-hidden="true" />
            {gstinValidation.stateCode} — {stateName}
          </span>
        )}
        {gstinValidation.valid !== true && (
          <span id="gsv2-gstin-hint" className="gsv2-hint">{t.gstinHint}</span>
        )}
      </div>

      {/* State mismatch warning */}
      {stateCodeMismatch && (
        <div className="gsv2-warning" role="alert">
          <AlertTriangle size={16} className="gsv2-warning-icon" aria-hidden="true" />
          <span>{t.gstinStateCodeMismatch}</span>
        </div>
      )}

      {/* Tax settings — gated */}
      <div className={form.gstEnabled ? '' : 'gsv2-disabled-fields'}>
        <div className="gsv2-card">
          <div className="gsv2-card-header">
            <span className="gsv2-card-title">{t.gstTaxSettingsTitle}</span>
          </div>

          {/* taxPricingMode chip selector */}
          <div className="gsv2-field">
            <span className="gsv2-label">{t.taxPricingModeLabel}</span>
            <div className="gsv2-chip-group" role="group" aria-label={t.taxPricingModeLabel}>
              {PRICING_MODES.map(mode => (
                <Button variant="none"
                  key={mode}
                  className={[
                    'gsv2-chip-btn',
                    form.taxPricingMode === mode ? 'gsv2-chip-btn--active' : '',
                  ].join(' ')}
                  onClick={() => onPatch('taxPricingMode', mode)}
                  aria-pressed={form.taxPricingMode === mode}
                  disabled={isSaving || !form.gstEnabled}
                >
                  {mode === 'EXCLUSIVE' ? t.taxModeExclusive : t.taxModeInclusive}
                </Button>
              ))}
            </div>
            <span className="gsv2-hint">
              {form.taxPricingMode === 'EXCLUSIVE' ? t.taxModeExclusiveDesc : t.taxModeInclusiveDesc}
            </span>
          </div>

          {/* compositionScheme toggle */}
          <div className="gsv2-row">
            <div>
              <div className="gsv2-row-label">{t.compositionScheme}</div>
              <div className="gsv2-row-desc">{t.compositionSchemeDesc}</div>
            </div>
            <div className="gsv2-row-right">
              <Button variant="none"
                className="gsv2-toggle"
                role="switch"
                aria-checked={form.compositionScheme}
                aria-label={form.compositionScheme
                  ? t.compositionSchemeEnabled
                  : t.compositionSchemeDisabled}
                onClick={() => onPatch('compositionScheme', !form.compositionScheme)}
                disabled={isSaving || !form.gstEnabled}
              >
                <span className="gsv2-toggle-thumb" />
              </Button>
            </div>
          </div>

          {/* compositionRate — only when compositionScheme=true */}
          {form.compositionScheme && (
            <div className="gsv2-field">
              <label className="gsv2-label" htmlFor="gsv2-comp-rate">
                {t.compositionRateLabel}
              </label>
              <Select
                value={form.compositionRate != null ? String(form.compositionRate) : undefined}
                onValueChange={(s) => {
                  const v = parseInt(s, 10)
                  onPatch('compositionRate', (compositionRates.includes(v as CompositionRate)
                    ? v : null) as CompositionRate | null)
                }}
                disabled={isSaving || !form.gstEnabled}
                ariaLabel={t.compositionRateLabel}
                placeholder={t.selectCompositionRate}
              >
                {compositionRates.map(r => (
                  <SelectItem key={r} value={String(r)}>{rateLabel(r)}</SelectItem>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Declaration text */}
      <div className="gsv2-card">
        <div className="gsv2-card-header">
          <span className="gsv2-card-title">{t.gstDeclarationTitle}</span>
        </div>
        <div className="gsv2-field">
          <label className="gsv2-label" htmlFor="gsv2-declaration">
            {t.gstDeclarationLabel}
          </label>
          <Textarea
            id="gsv2-declaration"
            className="gsv2-textarea"
            value={form.gstDeclarationText}
            maxLength={500}
            placeholder={t.gstDeclarationPlaceholder}
            onChange={e => onPatch('gstDeclarationText', e.target.value)}
            rows={3}
            disabled={isSaving}
          />
          <span className={`gsv2-char-count ${decWarn ? 'gsv2-char-count--warn' : ''}`}>
            {decLen}/500
          </span>
        </div>
      </div>
    </>
  )
}
