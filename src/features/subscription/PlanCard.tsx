/** PlanCard — single-tier card used inside UpgradeDrawer. */

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { PlanTier } from './plan-limits'
import { PLAN_PRICE_PAISE } from './subscription.constants'
import { Heading } from '@/components/ui/Heading'

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
          className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: 'var(--color-secondary-300)',
            color: 'var(--color-primary-700)',
          }}
        >
          {t.recommendedPlan}
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <Heading level={3}
          className="text-lg font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t[labelKey]}
        </Heading>
        <div className="text-right">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {pricePaise === 0 ? '₹0' : formatPaise(pricePaise)}
          </span>
          <span
            className="text-sm ml-1"
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
            className="flex items-start gap-2 text-sm"
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
        className="w-full mt-4 min-h-11"
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
