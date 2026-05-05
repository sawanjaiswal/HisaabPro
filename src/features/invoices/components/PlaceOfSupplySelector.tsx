/** Invoice Form — Place of Supply selector
 *
 * Combobox of 28 Indian states + "OOS" (out-of-state / export).
 * Defaults to business state (derived from GSTIN stateCode).
 * Determines inter-state (IGST) vs intra-state (CGST+SGST).
 * Shown in invoice header, only when gstEnabled = true.
 */

import { useEffect } from 'react'
import { INDIAN_STATE_OPTIONS } from '@/features/gst/constants/states'

interface PlaceOfSupplySelectorProps {
  value: string
  businessStateCode: string | null
  onChange: (code: string) => void
  error?: string
}

export function PlaceOfSupplySelector({
  value,
  businessStateCode,
  onChange,
  error,
}: PlaceOfSupplySelectorProps) {
  // Default to business state on first render
  useEffect(() => {
    if (!value && businessStateCode) {
      onChange(businessStateCode)
    }
  }, [value, businessStateCode, onChange])

  return (
    <div className="pos-selector">
      <label className="label" htmlFor="place-of-supply">
        Place of Supply
        <span className="label-required" aria-hidden="true"> *</span>
      </label>
      <select
        id="place-of-supply"
        className={`input${error ? ' input-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'pos-error' : undefined}
      >
        <option value="">-- Select state --</option>
        {INDIAN_STATE_OPTIONS.map(({ code, name }) => (
          <option key={code} value={code}>
            {code === 'OOS' ? name : `${code} — ${name}`}
          </option>
        ))}
      </select>
      {error && (
        <span id="pos-error" className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
