/** Composition Mode Indicator — GST Phase 2 PR 6
 *
 * Orange/amber badge replacing "Tax Invoice" label when business is under
 * Composition Scheme. Shown in invoice form header and in PDF header.
 * Composition dealers issue "Bill of Supply" — no CGST/SGST/IGST collected.
 */

import { useLanguage } from '@/hooks/useLanguage'

export function CompositionModeIndicator() {
  const { t } = useLanguage()

  return (
    <div className="composition-mode-indicator" role="status" aria-live="polite">
      <span className="composition-mode-dot" aria-hidden="true" />
      <span className="composition-mode-label">{t.billOfSupplyBadge}</span>
    </div>
  )
}
