/**
 * UpgradeDrawer — bottom-sheet plan picker. Lists every tier above current,
 * highlights the recommended one, and submits an upgrade mutation.
 */

import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { useSubscription } from '@/hooks/useSubscription'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
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
  const toast = useToast()
  const qc = useQueryClient()
  const { plan: current } = useSubscription()
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null)

  const handleSelect = async (tier: PlanTier) => {
    if (PLAN_HIERARCHY[tier] <= PLAN_HIERARCHY[current]) return
    setBusyTier(tier)
    try {
      await api('/subscription/upgrade', {
        method: 'POST',
        body: JSON.stringify({ tier, billingCycle: 'MONTHLY' }),
        entityType: 'subscription',
        entityLabel: `${tier} plan`,
      })
      await qc.invalidateQueries({ queryKey: ['subscription'] })
      toast.success(
        navigator.onLine
          ? (t as unknown as Record<string, string>).subStateActive
          : t.saveQueuedOnline,
      )
      onClose()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t.upgradeFailedTryAgain,
      )
    } finally {
      setBusyTier(null)
    }
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
            busy={busyTier !== null}
          />
        ))}
        <TierComparisonCard />
      </div>
    </Drawer>
  )
}

export default UpgradeDrawer
