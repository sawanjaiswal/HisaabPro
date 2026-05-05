/** Invoice Form — GST header section (gstEnabled gate required before rendering)
 *
 * Combines: PlaceOfSupplySelector + RcmToggle + TaxPricingChip.
 * Shown only when gstEnabled = true (caller must gate).
 * Composition mode shows "Bill of Supply" label instead of tax picker row.
 */

import { useGstGate } from '@/features/gst/useGstGate'
import { PlaceOfSupplySelector } from './PlaceOfSupplySelector'
import { RcmToggle } from './RcmToggle'
import { TaxPricingChip } from './TaxPricingChip'
import type { DocumentFormData } from '../invoice.types'
import type { TaxPricingMode } from '@/features/tax/tax.types'

interface GstInvoiceHeaderProps {
  form: DocumentFormData
  errors: Record<string, string>
  onUpdateField: <K extends keyof DocumentFormData>(key: K, value: DocumentFormData[K]) => void
}

export function GstInvoiceHeader({ form, errors, onUpdateField }: GstInvoiceHeaderProps) {
  const { compositionScheme, gstin } = useGstGate()

  // Derive business state code from GSTIN (first 2 chars)
  const businessStateCode = gstin ? gstin.substring(0, 2) : null

  return (
    <div className="gst-invoice-header" role="group" aria-label="GST settings for this invoice">
      {compositionScheme && (
        <div className="composition-badge" role="note">
          Bill of Supply — Composition Scheme (tax not collected)
        </div>
      )}

      <div className="gst-header-row">
        <PlaceOfSupplySelector
          value={form.placeOfSupply ?? ''}
          businessStateCode={businessStateCode}
          onChange={(code) => onUpdateField('placeOfSupply', code)}
          error={errors.placeOfSupply}
        />

        {!compositionScheme && (
          <div className="gst-header-chip-group">
            <span className="label">Pricing</span>
            <TaxPricingChip
              value={form.taxPricingMode}
              onChange={(mode: TaxPricingMode) => onUpdateField('taxPricingMode', mode)}
            />
          </div>
        )}
      </div>

      {!compositionScheme && (
        <RcmToggle
          checked={form.isReverseCharge}
          supplyType={form.supplyType}
          onChange={(checked) => onUpdateField('isReverseCharge', checked)}
        />
      )}
    </div>
  )
}
