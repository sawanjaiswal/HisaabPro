/**
 * Commission #128 — Rate banner sub-component (S2 visual guard).
 *
 * Renders one of two banners based on `validateRateBps()`:
 *   • warn  (5000 ≤ bps < 10000) → yellow status banner with info icon
 *   • block (bps ≥ 10000)        → red alert banner with warning icon
 *   • neither                    → null
 *
 * Pure visual — does NOT disable the save button itself. The parent form
 * reads the same `validateRateBps()` result to set `disabled` on submit.
 */

import { AlertTriangle, Info } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import {
  RATE_MAX_BPS,
  RATE_WARN_BPS,
} from '../commission.constants'
import { bpsToPercentLabel, validateRateBps } from '../commission.utils'

interface RateBannerProps {
  rateBps: number
}

export function RateBanner({ rateBps }: RateBannerProps) {
  const { t } = useLanguage()
  const validation = validateRateBps(rateBps)

  if (validation.block) {
    return (
      <div
        role="alert"
        className="commission-rule-form__banner commission-rule-form__banner--block"
      >
        <AlertTriangle size={16} aria-hidden="true" />
        <span>
          {t.commissionRateBlockBanner.replace(
            '{percent}',
            bpsToPercentLabel(RATE_MAX_BPS)
          )}
        </span>
      </div>
    )
  }

  if (validation.warn) {
    return (
      <div
        role="status"
        className="commission-rule-form__banner commission-rule-form__banner--warn"
      >
        <Info size={16} aria-hidden="true" />
        <span>
          {t.commissionRateWarnBanner.replace(
            '{percent}',
            bpsToPercentLabel(RATE_WARN_BPS)
          )}
        </span>
      </div>
    )
  }

  return null
}
