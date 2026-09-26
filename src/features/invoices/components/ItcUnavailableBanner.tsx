/** ITC Unavailable Banner — GST Phase 2 PR 6
 *
 * Blue info banner shown on the invoice form when compositionScheme=true
 * AND any line item has a taxCategoryId set.
 * Composition dealers cannot collect or pass on ITC.
 */

import { Text } from '@/components/ui/Text'
import { Info } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { LineItemFormData } from '../invoice.types'

interface ItcUnavailableBannerProps {
  lineItems: LineItemFormData[]
}

export function ItcUnavailableBanner({ lineItems }: ItcUnavailableBannerProps) {
  const { t } = useLanguage()
  const hasTaxableLines = lineItems.some(li => li.taxCategoryId)

  if (!hasTaxableLines) return null

  return (
    <div className="itc-unavailable-banner" role="note" aria-label={t.itcUnavailableLabel}>
      <Info size={16} className="itc-unavailable-icon" aria-hidden="true" />
      <Text className="itc-unavailable-text">{t.itcUnavailableText}</Text>
    </div>
  )
}
