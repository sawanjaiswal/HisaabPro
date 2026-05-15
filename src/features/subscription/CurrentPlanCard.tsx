/**
 * CurrentPlanCard — summary of the active plan (tier, payment method, next
 * billing date, primary actions). Extracted from SubscriptionManagePage to
 * keep the page ≤ 250 lines.
 */

import { Crown, CreditCard, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { PlanTier } from './plan-limits'
import type { SubscriptionData } from './subscription.types'

const PLAN_LABEL_KEY = {
  FREE: 'planFree',
  PRO: 'planPro',
  BUSINESS: 'planBusiness',
  PRO_MAX: 'planProMax',
} as const

const METHOD_LABEL_KEY = {
  MANUAL: 'paymentMethodManual',
  UPI_AUTOPAY: 'paymentMethodUpiAutopay',
  CARD: 'paymentMethodCard',
} as const

interface CurrentPlanCardProps {
  plan: PlanTier
  subscription: SubscriptionData
  onUpgrade: () => void
  onCancel: () => void
}

export function CurrentPlanCard({
  plan,
  subscription,
  onUpgrade,
  onCancel,
}: CurrentPlanCardProps) {
  const { t } = useLanguage()
  const tStrings = t as unknown as Record<string, string>
  const method = subscription.paymentMethod ?? 'MANUAL'

  return (
    <Card className="p-4 subscription-plan-card">
      <div className="flex items-start gap-3">
        <Crown
          className="w-6 h-6 flex-shrink-0"
          style={{ color: 'var(--color-primary-500)' }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-[var(--fs-xs)] uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {t.currentPlan}
          </p>
          <p
            className="text-[var(--fs-xl)] font-semibold mt-0.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {tStrings[PLAN_LABEL_KEY[plan]]}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[var(--fs-sm)]">
        <div className="flex items-center gap-2">
          <CreditCard
            className="w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden
          />
          <span style={{ color: 'var(--text-secondary)' }}>
            {t.paymentMethodLabel}:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {tStrings[METHOD_LABEL_KEY[method]]}
            </strong>
          </span>
        </div>
        {subscription.nextBillingAt && (
          <div className="flex items-center gap-2">
            <Calendar
              className="w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              {t.nextBillingOn}:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {new Date(subscription.nextBillingAt).toLocaleDateString('en-IN')}
              </strong>
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={onUpgrade}
          className="min-h-[44px]"
        >
          {t.upgradeToPlan}
        </Button>
        {plan !== 'FREE' && (
          <Button
            variant="destructive"
            size="md"
            onClick={onCancel}
            className="min-h-[44px]"
          >
            {t.cancelSubscription}
          </Button>
        )}
      </div>
    </Card>
  )
}

export default CurrentPlanCard
