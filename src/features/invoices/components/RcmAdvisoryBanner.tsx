/** RCM Advisory Banner — GST Phase 2 PR 6
 *
 * Blue info banner shown on the invoice form when isReverseCharge=true.
 * Informs the user that the buyer (recipient) will self-assess GST under RCM.
 */

import { Info } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface RcmAdvisoryBannerProps {
  isReverseCharge: boolean
}

export function RcmAdvisoryBanner({ isReverseCharge }: RcmAdvisoryBannerProps) {
  const { t } = useLanguage()

  if (!isReverseCharge) return null

  return (
    <div className="rcm-advisory-banner" role="note" aria-label={t.rcmAdvisoryLabel}>
      <Info size={16} className="rcm-advisory-icon" aria-hidden="true" />
      <p className="rcm-advisory-text">{t.rcmAdvisoryText}</p>
    </div>
  )
}
