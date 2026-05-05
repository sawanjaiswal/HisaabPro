/** Invoice Form — Tax pricing mode chip (Exclusive / Inclusive)
 *
 * Two-option chip in the invoice header.
 * Toggling triggers client-side back-calculation preview via backCalculateInclusive().
 * Persisted to Document.taxPricingMode.
 */

import type { TaxPricingMode } from '@/features/tax/tax.types'

interface TaxPricingChipProps {
  value: TaxPricingMode
  onChange: (mode: TaxPricingMode) => void
}

const OPTIONS: { value: TaxPricingMode; label: string; desc: string }[] = [
  { value: 'EXCLUSIVE', label: 'Exclusive', desc: 'Tax added on top of price' },
  { value: 'INCLUSIVE', label: 'Inclusive (MRP)', desc: 'Tax included in price' },
]

export function TaxPricingChip({ value, onChange }: TaxPricingChipProps) {
  return (
    <div className="tax-pricing-chip" role="group" aria-label="Tax pricing mode">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`tax-chip-btn${value === opt.value ? ' tax-chip-btn-active' : ''}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          title={opt.desc}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
