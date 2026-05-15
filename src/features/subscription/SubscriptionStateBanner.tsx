/**
 * SubscriptionStateBanner — compact status strip shown at the top of the
 * Subscription Manage page. Combines state badge + a contextual CTA.
 */

import { CreditCard, ShieldCheck, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { useSubscription } from '@/hooks/useSubscription'
import { STATE_BADGE_VARIANT, STATE_LABEL_KEY } from './subscription.constants'

interface SubscriptionStateBannerProps {
  onSetupMandate: () => void
  onUpgrade: () => void
  onReactivate: () => void
}

export function SubscriptionStateBanner({
  onSetupMandate,
  onUpgrade,
  onReactivate,
}: SubscriptionStateBannerProps) {
  const { t } = useLanguage()
  const { state, isLocked, isInGrace, mandate } = useSubscription()
  const labelKey = STATE_LABEL_KEY[state]
  const variant = STATE_BADGE_VARIANT[state]
  const tStrings = t as unknown as Record<string, string>

  const renderCta = () => {
    if (state === 'TRIAL_NO_AUTOPAY' && (!mandate || mandate.status !== 'ACTIVE')) {
      return (
        <Button variant="primary" size="sm" onClick={onSetupMandate}>
          <CreditCard className="w-4 h-4" />
          {t.mandateOpenUpiApp}
        </Button>
      )
    }
    if (isLocked) {
      return (
        <Button variant="primary" size="sm" onClick={onUpgrade}>
          {t.upgradeNow}
        </Button>
      )
    }
    if (state === 'CANCELLED') {
      return (
        <Button variant="secondary" size="sm" onClick={onReactivate}>
          {t.reactivateSubscription}
        </Button>
      )
    }
    return null
  }

  const Icon = isLocked ? AlertCircle : isInGrace ? AlertCircle : ShieldCheck
  return (
    <div
      className="rounded-[var(--radius-md)] p-3 flex items-center gap-3"
      style={{
        backgroundColor: 'var(--color-gray-0)',
        border: '1px solid var(--color-gray-100)',
      }}
    >
      <Icon
        className="w-5 h-5 flex-shrink-0"
        style={{
          color: isLocked
            ? 'var(--color-error-500)'
            : isInGrace
              ? 'var(--color-warning-500)'
              : 'var(--color-success-500)',
        }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <Badge variant={variant}>{tStrings[labelKey] ?? labelKey}</Badge>
        {isInGrace && (
          <span
            className="ml-2 text-[var(--fs-xs)]"
            style={{ color: 'var(--text-muted)' }}
          >
            {t.mandateRequired}
          </span>
        )}
      </div>
      {renderCta()}
    </div>
  )
}

export default SubscriptionStateBanner
