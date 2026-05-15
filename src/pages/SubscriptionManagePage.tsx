/**
 * SubscriptionManagePage — settings page for managing the active subscription.
 *
 * Shows: state banner, current plan summary, addons, manage actions
 * (upgrade / cancel / reactivate / mandate setup). Wires into the
 * subscription-port FE state machine.
 */

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { useSubscription } from '@/hooks/useSubscription'
import { useEntitlementToken } from '@/hooks/useEntitlementToken'
import { SubscriptionStateBanner } from '@/features/subscription/SubscriptionStateBanner'
import { OverflowBanner } from '@/features/subscription/OverflowBanner'
import { AddonBadge } from '@/features/subscription/AddonBadge'
import { UpgradeDrawer } from '@/features/subscription/UpgradeDrawer'
import { MandateSetupDrawer } from '@/features/subscription/MandateSetupDrawer'
import { CurrentPlanCard } from '@/features/subscription/CurrentPlanCard'
import { useManageActions } from '@/features/subscription/useManageActions'
import '@/features/subscription/subscription.css'

export function SubscriptionManagePage() {
  const { t } = useLanguage()
  const { subscription, plan, isLoading, isError, refetch, addons } =
    useSubscription()
  useEntitlementToken() // boot-fetch + cache the offline JWT silently

  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [mandateOpen, setMandateOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const { cancel, reactivate, cancelling, reactivating } = useManageActions(plan)

  const handleCancel = async () => {
    try {
      await cancel()
      setConfirmCancel(false)
    } catch {
      /* toast already shown */
    }
  }

  return (
    <AppShell>
      <Header title={t.subscription} backTo />
      <PageContainer variant="form">
        <OverflowBanner onUpgrade={() => setUpgradeOpen(true)} />

        <div className="px-4 py-4 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton height="4rem" />
              <Skeleton height="10rem" />
            </div>
          ) : isError || !subscription ? (
            <ErrorState
              title={t.subscriptionLoadFailed}
              onRetry={() => refetch()}
            />
          ) : (
            <>
              <SubscriptionStateBanner
                onSetupMandate={() => setMandateOpen(true)}
                onUpgrade={() => setUpgradeOpen(true)}
                onReactivate={reactivate}
              />

              <CurrentPlanCard
                plan={plan}
                subscription={subscription}
                onUpgrade={() => setUpgradeOpen(true)}
                onCancel={() => setConfirmCancel(true)}
              />

              <section className="subscription-section py-0">
                <p
                  className="text-[var(--fs-xs)] font-medium uppercase tracking-wider mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t.addonActive}
                </p>
                {addons.length === 0 ? (
                  <EmptyState
                    title={t.noAddonsYet}
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setUpgradeOpen(true)}
                      >
                        {t.exploreAddons}
                      </Button>
                    }
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {addons.map((a) => (
                      <AddonBadge key={a.code} addon={a} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <UpgradeDrawer open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
        <MandateSetupDrawer
          open={mandateOpen}
          onClose={() => setMandateOpen(false)}
        />
        <ConfirmDialog
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          onConfirm={handleCancel}
          title={t.cancelConfirmTitle}
          description={t.cancelConfirmDesc}
          confirmLabel={t.cancelConfirmAction}
          cancelLabel={t.cancelKeepAction}
          isDanger
          isLoading={cancelling || reactivating}
        />
      </PageContainer>
    </AppShell>
  )
}

export default SubscriptionManagePage
