/** Invoice Form — Reverse Charge Mechanism toggle
 *
 * Checkbox shown only when gstEnabled AND supplyType = 'B2B'.
 * When checked, shows advisory: "Customer will self-assess tax under RCM".
 * Server zeroes document-level totals; line amounts retained for audit.
 */

import { Info } from 'lucide-react'

interface RcmToggleProps {
  checked: boolean
  supplyType: string
  onChange: (checked: boolean) => void
}

export function RcmToggle({ checked, supplyType, onChange }: RcmToggleProps) {
  if (supplyType !== 'B2B') return null

  return (
    <div className="rcm-toggle">
      <label className="rcm-label" htmlFor="rcm-checkbox">
        <input
          id="rcm-checkbox"
          type="checkbox"
          className="rcm-checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={checked ? 'rcm-advisory' : undefined}
        />
        <span className="rcm-label-text">Reverse Charge Mechanism (RCM)</span>
      </label>

      {checked && (
        <div id="rcm-advisory" className="rcm-advisory" role="note">
          <Info size={14} aria-hidden="true" className="rcm-advisory-icon" />
          <span>Customer will self-assess tax under RCM. Tax is shown on the invoice but not collected.</span>
        </div>
      )}
    </div>
  )
}
