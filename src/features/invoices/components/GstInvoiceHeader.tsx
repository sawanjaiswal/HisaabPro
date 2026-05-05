/** Invoice Form — GST header section (gstEnabled gate required before rendering)
 *
 * Combines: CompositionModeIndicator | PlaceOfSupplySelector + RcmToggle + TaxPricingChip.
 * Shown only when gstEnabled = true (caller must gate).
 * Composition mode hides place-of-supply, RCM toggle, and tax pricing chip.
 * GST Phase 2 PR 6: adds CompositionModeIndicator, ItcUnavailableBanner, RcmAdvisoryBanner.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { useGstGate } from '@/features/gst/useGstGate'
import { PlaceOfSupplySelector } from './PlaceOfSupplySelector'
import { RcmToggle } from './RcmToggle'
import { TaxPricingChip } from './TaxPricingChip'
import { CompositionModeIndicator } from './CompositionModeIndicator'
import { ItcUnavailableBanner } from './ItcUnavailableBanner'
import { RcmAdvisoryBanner } from './RcmAdvisoryBanner'
import type { DocumentFormData } from '../invoice.types'
import type { TaxPricingMode } from '@/features/tax/tax.types'

interface GstInvoiceHeaderProps {
  form: DocumentFormData
  errors: Record<string, string>
  onUpdateField: <K extends keyof DocumentFormData>(key: K, value: DocumentFormData[K]) => void
}

export function GstInvoiceHeader({ form, errors, onUpdateField }: GstInvoiceHeaderProps) {
  const { compositionScheme, gstin } = useGstGate()
  const { t } = useLanguage()

  // Derive business state code from GSTIN (first 2 chars)
  const businessStateCode = gstin ? gstin.substring(0, 2) : null

  return (
    <div className="gst-invoice-header" role="group" aria-label={t.gstInvoiceHeaderLabel}>
      {compositionScheme && <CompositionModeIndicator />}

      {!compositionScheme && (
        <div className="gst-header-row">
          <PlaceOfSupplySelector
            value={form.placeOfSupply ?? ''}
            businessStateCode={businessStateCode}
            onChange={(code) => onUpdateField('placeOfSupply', code)}
            error={errors.placeOfSupply}
          />

          <div className="gst-header-chip-group">
            <span className="label">{t.pricingLabel}</span>
            <TaxPricingChip
              value={form.taxPricingMode}
              onChange={(mode: TaxPricingMode) => onUpdateField('taxPricingMode', mode)}
            />
          </div>
        </div>
      )}

      {!compositionScheme && (
        <RcmToggle
          checked={form.isReverseCharge}
          supplyType={form.supplyType}
          onChange={(checked) => onUpdateField('isReverseCharge', checked)}
        />
      )}

      {compositionScheme && (
        <ItcUnavailableBanner lineItems={form.lineItems} />
      )}

      {!compositionScheme && (
        <RcmAdvisoryBanner isReverseCharge={form.isReverseCharge} />
      )}
    </div>
  )
}
