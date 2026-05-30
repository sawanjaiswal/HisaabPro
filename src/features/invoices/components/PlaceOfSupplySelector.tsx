/** Invoice Form — Place of Supply selector
 *
 * Combobox of 28 Indian states + "OOS" (out-of-state / export).
 * Defaults to business state (derived from GSTIN stateCode).
 * Determines inter-state (IGST) vs intra-state (CGST+SGST).
 * Shown in invoice header, only when gstEnabled = true.
 */

import { useEffect } from 'react'
import { INDIAN_STATE_OPTIONS } from '@/features/gst/constants/states'
import { Select, SelectItem } from '@/components/ui/Select'

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
      <Select
        value={value || undefined}
        onValueChange={onChange}
        ariaLabel="Place of Supply"
        placeholder="-- Select state --"
      >
        {INDIAN_STATE_OPTIONS.map(({ code, name }) => (
          <SelectItem key={code} value={code}>
            {code === 'OOS' ? name : `${code} — ${name}`}
          </SelectItem>
        ))}
      </Select>
      {error && (
        <span id="pos-error" className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
