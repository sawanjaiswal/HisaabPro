/**
 * <PlanGate feature="accounting"> — renders children only when the current
 * plan unlocks the given feature. Otherwise renders <UpgradePrompt>.
 *
 * Wrap paid screens in App.tsx to prevent a 402 round-trip.
 */

import type { ReactNode } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { UpgradePrompt } from '@/components/UpgradePrompt'
import { isFeatureAllowed, minTierFor, type FeatureFlag } from './plan-limits'

interface PlanGateProps {
  feature: FeatureFlag
  featureLabel?: string
  children: ReactNode
  /** Optional custom fallback — defaults to <UpgradePrompt/> */
  fallback?: ReactNode
}

export function PlanGate({ feature, featureLabel, children, fallback }: PlanGateProps) {
  const { plan, isLoading } = useSubscription()

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}
      >
        Checking your plan…
      </div>
    )
  }

  if (isFeatureAllowed(plan, feature)) return <>{children}</>

  if (fallback) return <>{fallback}</>

  const required = minTierFor(feature)
  // UpgradePrompt only supports PRO / BUSINESS today.
  const requiredPlan = required === 'FREE' ? 'PRO' : required
  return (
    <div style={{ padding: '1rem' }}>
      <UpgradePrompt requiredPlan={requiredPlan} feature={featureLabel} />
    </div>
  )
}

export default PlanGate
