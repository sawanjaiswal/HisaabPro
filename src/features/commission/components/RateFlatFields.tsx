/**
 * Commission #128 — Percent-rate + flat-per-unit input fields.
 *
 * Extracted from CommissionRuleForm so the parent stays under the 250 LOC
 * cap. Renders the percent input + <RateBanner> in PERCENT_* modes, or the
 * flat-per-unit input in FLAT_PER_UNIT mode. Pure presentational.
 */

import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import { FLAT_MAX_PAISE } from '../commission.constants'
import { RateBanner } from './RateBanner'

interface RateFlatFieldsProps {
  isPercentMode: boolean
  isFlatMode: boolean
  ratePercent: string
  onRatePercentChange: (v: string) => void
  rateBps: number
  flatPerUnitRupees: string
  onFlatPerUnitChange: (v: string) => void
}

const blockExponentKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
}

export function RateFlatFields({
  isPercentMode,
  isFlatMode,
  ratePercent,
  onRatePercentChange,
  rateBps,
  flatPerUnitRupees,
  onFlatPerUnitChange,
}: RateFlatFieldsProps) {
  const { t } = useLanguage()

  if (isPercentMode) {
    return (
      <div>
        <Input
          label={t.commissionRateLabel}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={ratePercent}
          onChange={(e) => onRatePercentChange(e.target.value)}
          onKeyDown={blockExponentKeys}
          aria-describedby="commission-rate-hint"
        />
        <p id="commission-rate-hint" className="commission-rule-form__hint">
          {t.commissionRateHint}
        </p>
        <RateBanner rateBps={rateBps} />
      </div>
    )
  }

  if (isFlatMode) {
    return (
      <div>
        <Input
          label={t.commissionFlatLabel}
          type="number"
          inputMode="numeric"
          min={0}
          max={Math.floor(FLAT_MAX_PAISE / 100)}
          step={1}
          value={flatPerUnitRupees}
          onChange={(e) => onFlatPerUnitChange(e.target.value)}
          onKeyDown={blockExponentKeys}
        />
        <p className="commission-rule-form__hint">{t.commissionFlatHint}</p>
      </div>
    )
  }

  return null
}
