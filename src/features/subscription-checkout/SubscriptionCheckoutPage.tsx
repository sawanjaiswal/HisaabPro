/**
 * SubscriptionCheckoutPage — cross-platform Razorpay UPI checkout orchestrator.
 *
 * Picks one of three surfaces (android-native plugin / phone-web checkout.js /
 * desktop-web QR), drives the UX FSM, and polls the server for webhook-driven
 * activation. Entitlement is granted ONLY by the webhook→FSM writer — this
 * page never flips state client-side.
 */

import { useEffect, useReducer } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { PLAN_HIERARCHY, type PlanTier } from '@/features/subscription/plan-limits'
import { useCheckoutDevice } from './hooks/useCheckoutDevice'
import { useCheckoutSession } from './hooks/useCheckoutSession'
import { useCheckoutStatusPoll } from './hooks/useCheckoutStatusPoll'
import { nextPhase, initialPhase } from './utils/checkout-status.utils'
import { NativeRazorpayCheckout } from './components/NativeRazorpayCheckout'
import { MobileRazorpayCheckout } from './components/MobileRazorpayCheckout'
import { DesktopQrCheckout } from './components/DesktopQrCheckout'
import { CheckoutStatusView } from './components/CheckoutStatusView'
import type { BillingCycle, CheckoutSurfaceProps } from './subscription-checkout.types'
import './subscription-checkout.css'

const SURFACE_COMPONENT = {
  'android-native': NativeRazorpayCheckout,
  'phone-web': MobileRazorpayCheckout,
  'desktop-web': DesktopQrCheckout,
} as const

function parseTier(raw: string | null): PlanTier | null {
  if (raw === 'PRO' || raw === 'BUSINESS' || raw === 'PRO_MAX') return raw
  return null
}

export default function SubscriptionCheckoutPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const surface = useCheckoutDevice()
  const session = useCheckoutSession()
  const [phase, dispatch] = useReducer(nextPhase, undefined, initialPhase)

  const tier = parseTier(params.get('tier'))
  const cycle: BillingCycle = params.get('cycle') === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
  const couponCode = params.get('coupon') ?? undefined

  // Kick off session creation once for a valid tier.
  useEffect(() => {
    if (!tier) return
    dispatch({ kind: 'open_clicked' })
    session.mutate({ tier, billingCycle: cycle, couponCode })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier])

  useCheckoutStatusPoll(phase, dispatch)

  // On terminal success, refresh the cached subscription so the rest of the app
  // reflects the new plan immediately.
  useEffect(() => {
    if (phase.kind === 'success') void qc.invalidateQueries({ queryKey: ['subscription'] })
  }, [phase.kind, qc])

  const goToSubscription = () => navigate(ROUTES.SETTINGS_SUBSCRIPTION)
  const retry = () => {
    if (phase.kind === 'stranded') dispatch({ kind: 'user_retry' })
    else navigate(0)
  }

  const isStatusPhase =
    phase.kind === 'success' ||
    phase.kind === 'failed' ||
    phase.kind === 'cancelled' ||
    phase.kind === 'stranded' ||
    (phase.kind === 'polling' && surface !== 'desktop-web')

  let body: React.ReactNode
  if (!tier || (tier && PLAN_HIERARCHY[tier] === 0)) {
    body = (
      <EmptyState
        icon={<CreditCard size={22} aria-hidden="true" />}
        title={t.checkoutNoPlanTitle}
        description={t.checkoutNoPlanBody}
      />
    )
  } else if (session.isPending) {
    body = (
      <div className="checkout-loading">
        <Skeleton height="1.5rem" />
        <Skeleton height="10rem" borderRadius="var(--radius-xl)" />
      </div>
    )
  } else if (session.isError || !session.data) {
    body = <ErrorState title={t.checkoutSessionFailedTitle} message={t.checkoutSessionFailedBody} onRetry={() => navigate(0)} retryLabel={t.tryAgain} />
  } else if (isStatusPhase) {
    body = <CheckoutStatusView phase={phase} onRetry={retry} onDone={goToSubscription} />
  } else {
    const Surface = SURFACE_COMPONENT[surface] as React.FC<CheckoutSurfaceProps>
    body = <Surface session={session.data} phase={phase} onEvent={dispatch} />
  }

  return (
    <AppShell>
      <Header title={t.checkoutHeading} backTo />
      <HeroPage>
        <Card className="checkout-card">{body}</Card>
      </HeroPage>
    </AppShell>
  )
}
