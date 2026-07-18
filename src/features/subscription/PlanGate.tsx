/**
 * <PlanGate feature="accounting"> — renders children only when the current
 * plan unlocks the given feature AND the subscription is in a serviceable
 * state. LOCKED + paywalled features get the UpgradeDrawer fallback; PAST_DUE
 * with active grace continues to render children but the OverflowBanner
 * upstream tells the user upgrade is coming.
 */

import { useState, type ReactNode } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { UpgradePrompt } from '@/components/UpgradePrompt'
import { ErrorState } from '@/components/feedback/ErrorState'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { minTierFor, type FeatureFlag } from './plan-limits'
import { resolveGateAccess } from './gate-policy'
import { UpgradeDrawer } from './UpgradeDrawer'
import { Button } from '@/components/ui/Button'

interface PlanGateProps {
  feature: FeatureFlag
  featureLabel?: string
  children: ReactNode
  /** Optional custom fallback — defaults to <UpgradePrompt/> */
  fallback?: ReactNode
}

export function PlanGate({ feature, featureLabel, children, fallback }: PlanGateProps) {
  const { plan, state, isInGrace, isLoading, isError, refetch } = useSubscription()
  const timedOut = useLoadTimeout(isLoading, 8000)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  // Single failure-mode policy: FREE-tier features fail OPEN (they render in
  // loading/error/timeout and are blocked only by a KNOWN LOCKED account);
  // paid features require a confirmed plan. See gate-policy.ts.
  const decision = resolveGateAccess({
    feature,
    plan,
    state,
    isInGrace,
    isLoading,
    isError,
    timedOut,
  })

  if (decision === 'allow') {
    return <>{children}</>
  }

  if (decision === 'error') {
    return (
      <ErrorState
        title="Couldn't verify your plan"
        message="Check your connection and try again."
        onRetry={() => refetch()}
      />
    )
  }

  if (decision === 'loading') {
    return (
      <div aria-busy="true" aria-live="polite" className="plan-gate-loading">
        Checking your plan…
      </div>
    )
  }

  // decision === 'upgrade'
  if (fallback) return <>{fallback}</>

  const required = minTierFor(feature)
  // UpgradePrompt only supports PRO / BUSINESS today.
  const requiredPlan =
    required === 'FREE' ? 'PRO' : required === 'PRO_MAX' ? 'BUSINESS' : required
  return (
    <AppShell>
      <Header title={featureLabel ?? 'Upgrade required'} backTo />
      <PageContainer>
        <UpgradePrompt requiredPlan={requiredPlan} feature={featureLabel} />
        <div className="mt-4 flex justify-center">
          <Button variant="none"
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="text-[var(--fs-sm)] underline"
            style={{ color: 'var(--color-primary-500)' }}
          >
            See all plans
          </Button>
        </div>
        <UpgradeDrawer
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          triggerFeature={featureLabel}
        />
      </PageContainer>
    </AppShell>
  )
}

export default PlanGate
