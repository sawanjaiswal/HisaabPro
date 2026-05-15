/** PlanCard — single-tier card used inside UpgradeDrawer. */

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/format'
import type { PlanTier } from './plan-limits'
import { PLAN_PRICE_PAISE } from './subscription.constants'

const PLAN_LABEL_KEY: Record<PlanTier, 'planFree' | 'planPro' | 'planBusiness' | 'planProMax'> = {
  FREE: 'planFree',
  PRO: 'planPro',
  BUSINESS: 'planBusiness',
  PRO_MAX: 'planProMax',
}

interface PlanCardProps {
  tier: PlanTier
  current: boolean
  recommended?: boolean
  features: string[]
  onSelect: (tier: PlanTier) => void
  busy?: boolean
  children?: ReactNode
}

export function PlanCard({
  tier,
  current,
  recommended,
  features,
  onSelect,
  busy,
  children,
}: PlanCardProps) {
  const { t } = useLanguage()
  const pricePaise = PLAN_PRICE_PAISE[tier]
  const labelKey = PLAN_LABEL_KEY[tier]
  return (
    <Card
      className="p-4 relative"
      style={{
        borderColor: current
          ? 'var(--color-primary-400)'
          : 'var(--color-gray-100)',
        borderWidth: '1px',
      }}
    >
      {recommended && (
        <span
          className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[var(--fs-xs)] font-semibold"
          style={{
            backgroundColor: 'var(--color-secondary-300)',
            color: 'var(--color-primary-700)',
          }}
        >
          {t.recommendedPlan}
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <h3
          className="text-[var(--fs-lg)] font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t[labelKey]}
        </h3>
        <div className="text-right">
          <span
            className="text-[var(--fs-2xl)] font-bold tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {pricePaise === 0 ? '₹0' : formatCurrency(pricePaise)}
          </span>
          <span
            className="text-[var(--fs-sm)] ml-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {t.perMonth}
          </span>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-[var(--fs-sm)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Check
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              style={{ color: 'var(--color-success-500)' }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        variant={current ? 'ghost' : 'primary'}
        className="w-full mt-4 min-h-[44px]"
        disabled={current || busy}
        onClick={() => onSelect(tier)}
      >
        {current ? t.currentPlan : t.upgradeToPlan}
      </Button>
      {children}
    </Card>
  )
}

export default PlanCard
