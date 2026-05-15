/** TierComparisonCard — compact feature-matrix for upgrade drawer. */

import { Check, X as XIcon } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { PLAN_DISPLAY_ORDER } from './subscription.constants'
import { PLAN_LIMITS, type FeatureFlag, type PlanTier } from './plan-limits'

const TIER_LABEL_KEY: Record<PlanTier, 'planFree' | 'planPro' | 'planBusiness' | 'planProMax'> = {
  FREE: 'planFree',
  PRO: 'planPro',
  BUSINESS: 'planBusiness',
  PRO_MAX: 'planProMax',
}

/** Curated 5-row comparison; SubscriptionManagePage shows the full list. */
const COMPARISON_FEATURES: ReadonlyArray<{ flag: FeatureFlag; labelKey: string }> = [
  { flag: 'gstFeatures', labelKey: 'gst' },
  { flag: 'accounting', labelKey: 'accounting' },
  { flag: 'multiGodown', labelKey: 'inventory' },
  { flag: 'posMode', labelKey: 'cart' },
  { flag: 'eInvoicing', labelKey: 'invoicing' },
]

export function TierComparisonCard() {
  const { t } = useLanguage()
  return (
    <div
      className="rounded-[var(--radius-md)] overflow-hidden"
      style={{
        backgroundColor: 'var(--color-gray-0)',
        border: '1px solid var(--color-gray-100)',
      }}
    >
      <table className="w-full text-[var(--fs-sm)]">
        <thead>
          <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
            <th className="text-left px-3 py-2 font-medium"
                style={{ color: 'var(--text-secondary)' }}>
              {t.comparePlans}
            </th>
            {PLAN_DISPLAY_ORDER.map((tier) => (
              <th
                key={tier}
                className="px-2 py-2 font-semibold text-center"
                style={{ color: 'var(--text-primary)' }}
              >
                {t[TIER_LABEL_KEY[tier]]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_FEATURES.map(({ flag, labelKey }) => (
            <tr key={flag}>
              <td className="px-3 py-2"
                  style={{ color: 'var(--text-secondary)' }}>
                {(t as unknown as Record<string, string>)[labelKey] ?? flag}
              </td>
              {PLAN_DISPLAY_ORDER.map((tier) => {
                const ok = PLAN_LIMITS[tier][flag] === true
                return (
                  <td key={tier} className="px-2 py-2 text-center">
                    {ok ? (
                      <Check className="w-4 h-4 inline-block"
                             style={{ color: 'var(--color-success-500)' }} />
                    ) : (
                      <XIcon className="w-4 h-4 inline-block"
                             style={{ color: 'var(--color-gray-400)' }} />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TierComparisonCard
