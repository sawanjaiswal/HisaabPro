/**
 * UpgradeDrawer — bottom-sheet plan picker. Lists every tier above current,
 * highlights the recommended one, and submits an upgrade mutation.
 */

import { useNavigate } from 'react-router-dom'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { useSubscription } from '@/hooks/useSubscription'
import { ROUTES } from '@/config/routes.config'
import { PlanCard } from './PlanCard'
import { TierComparisonCard } from './TierComparisonCard'
import { PLAN_DISPLAY_ORDER } from './subscription.constants'
import { PLAN_HIERARCHY, type PlanTier } from './plan-limits'

interface UpgradeDrawerProps {
  open: boolean
  onClose: () => void
  /** Optional: feature that triggered the upgrade — informs CTA text. */
  triggerFeature?: string
}

const PLAN_BULLETS: Record<PlanTier, string[]> = {
  FREE: ['50 invoices/month', '1 user', 'Basic reports'],
  PRO: ['Unlimited invoices', '3 users', 'GST + accounting', 'Recurring invoices'],
  BUSINESS: ['Unlimited users', 'Multi-godown', 'POS mode', 'Tally export', 'Batch tracking'],
  PRO_MAX: ['Everything in Business', 'e-Invoicing', 'Priority support', 'Serial tracking'],
}

export function UpgradeDrawer({ open, onClose }: UpgradeDrawerProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { plan: current } = useSubscription()

  // Route to the cross-platform checkout page; that surface owns the Razorpay
  // flow (native plugin / checkout.js / QR) and webhook-driven activation.
  const handleSelect = (tier: PlanTier) => {
    if (PLAN_HIERARCHY[tier] <= PLAN_HIERARCHY[current]) return
    onClose()
    navigate(`${ROUTES.SETTINGS_SUBSCRIPTION_CHECKOUT}?tier=${tier}&cycle=MONTHLY`)
  }

  const tierLabel = (tier: PlanTier) => {
    const key = tier === 'FREE' ? 'planFree' : tier === 'PRO' ? 'planPro' : tier === 'BUSINESS' ? 'planBusiness' : 'planProMax'
    return (t as unknown as Record<string, string>)[key]
  }

  return (
    <Drawer open={open} onClose={onClose} title={t.upgradeToPlan} size="lg">
      <div className="space-y-4 px-4 py-4">
        {PLAN_DISPLAY_ORDER.filter(
          (tier) => PLAN_HIERARCHY[tier] >= PLAN_HIERARCHY[current],
        ).map((tier) => (
          <PlanCard
            key={tier}
            tier={tier}
            current={tier === current}
            recommended={tier === 'BUSINESS'}
            features={PLAN_BULLETS[tier].map((b) => `${tierLabel(tier)}: ${b}`)}
            onSelect={handleSelect}
            busy={false}
          />
        ))}
        <TierComparisonCard />
      </div>
    </Drawer>
  )
}

export default UpgradeDrawer
