/** Barcode Field — Form input with format selector and live preview */

import { useState, useMemo } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { BarcodeFormat } from '@/lib/types/product.types'
import type { ProductFormData } from '../product.types'
import { BARCODE_FORMAT_OPTIONS, BARCODE_FORMAT_DEFAULT, BARCODE_MAX_LENGTH } from '../product.constants'
import { validateBarcode, getBarcodeHint } from '../barcode.utils'
import { BarcodeDisplay } from './BarcodeDisplay'

interface BarcodeFieldProps {
  form: ProductFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
}

export function BarcodeField({ form, errors, onUpdate }: BarcodeFieldProps) {
  const { t } = useLanguage()
  const [touched, setTouched] = useState(false)
  const currentFormat = form.barcodeFormat ?? BARCODE_FORMAT_DEFAULT
  const hint = getBarcodeHint(currentFormat)

  const validationError = useMemo(() => {
    if (!touched || !form.barcode) return null
    return validateBarcode(form.barcode, currentFormat)
  }, [form.barcode, currentFormat, touched])

  const displayError = errors.barcode ?? validationError

  return (
    <div className="barcode-field">
      <div className="input-group">
        <label htmlFor="product-barcode-format" className="input-label">{t.barcodeFormatLabel}</label>
        <select
          id="product-barcode-format"
          className="input"
          value={currentFormat}
          onChange={(e) => onUpdate('barcodeFormat', e.target.value as BarcodeFormat)}
          aria-label={t.selectBarcodeFormat}
        >
          {BARCODE_FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} — {opt.description}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label htmlFor="product-barcode" className="input-label">{t.barcodeValueLabel}</label>
        <input
          id="product-barcode"
          className={`input${displayError ? ' input-error-border' : ''}`}
          value={form.barcode ?? ''}
          onChange={(e) => onUpdate('barcode', e.target.value || undefined)}
          onBlur={() => setTouched(true)}
          placeholder={`${t.enterBarcodePrefix} ${currentFormat} barcode`}
          maxLength={BARCODE_MAX_LENGTH}
          autoComplete="off"
          aria-label={t.barcodeValueAria}
          aria-describedby={displayError ? 'barcode-error' : 'barcode-hint'}
        />
        {displayError && <p id="barcode-error" className="input-error" role="alert">{displayError}</p>}
        {!displayError && <p id="barcode-hint" className="input-hint">{hint}</p>}
      </div>

      {form.barcode && !displayError && (
        <BarcodeDisplay
          value={form.barcode}
          format={currentFormat}
          compact
        />
      )}
    </div>
  )
}
