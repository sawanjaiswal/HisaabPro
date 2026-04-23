/**
 * <PlanGate feature="accounting"> — renders children only when the current
 * plan unlocks the given feature. Otherwise renders <UpgradePrompt>.
 *
 * Wrap paid screens in App.tsx to prevent a 402 round-trip.
 */

import type { ReactNode } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { UpgradePrompt } from '@/components/UpgradePrompt'
import { ErrorState } from '@/components/feedback/ErrorState'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { isFeatureAllowed, minTierFor, type FeatureFlag } from './plan-limits'

interface PlanGateProps {
  feature: FeatureFlag
  featureLabel?: string
  children: ReactNode
  /** Optional custom fallback — defaults to <UpgradePrompt/> */
  fallback?: ReactNode
}

export function PlanGate({ feature, featureLabel, children, fallback }: PlanGateProps) {
  const { plan, isLoading, isError, refetch } = useSubscription()
  const timedOut = useLoadTimeout(isLoading, 8000)

  if (isError || timedOut) {
    return (
      <ErrorState
        title="Couldn't verify your plan"
        message="Check your connection and try again."
        onRetry={() => refetch()}
      />
    )
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="plan-gate-loading">
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
    <AppShell>
      <Header title={featureLabel ?? 'Upgrade required'} backTo />
      <PageContainer>
        <UpgradePrompt requiredPlan={requiredPlan} feature={featureLabel} />
      </PageContainer>
    </AppShell>
  )
}

export default PlanGate
