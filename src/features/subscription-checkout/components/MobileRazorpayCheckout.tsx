/**
 * MobileRazorpayCheckout — phone-web surface (mobile browser, NOT the app).
 *
 * Loads Razorpay checkout.js and opens the widget against the subscription_id.
 * In a real mobile browser (Chrome/Safari) UPI Intent works — it's only the
 * in-app WebView that disables it, which is why the Android app uses the native
 * plugin instead and this surface is never reached there.
 *
 * Webhook→FSM is SSOT: the success `handler` only dispatches `handler_fired`
 * (which starts the poll); it never grants entitlement client-side.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { APP_NAME } from '@/config/app.config'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { loadRazorpayCheckout } from '../utils/checkout-js-loader'
import { getRazorpayBackdropColor } from '../utils/checkout-theme.utils'
import { OPENING_TIMEOUT_MS } from '../subscription-checkout.constants'
import type {
  CheckoutSurfaceProps,
  RazorpayHandlerResponse,
} from '../subscription-checkout.types'

function buildPrefill(
  user: { name: string | null; phone: string; email: string | null } | null,
): Record<string, string> {
  const prefill: Record<string, string> = {}
  if (!user) return prefill
  if (user.name) prefill.name = user.name
  if (user.phone) prefill.contact = user.phone
  if (user.email) prefill.email = user.email
  return prefill
}

export function MobileRazorpayCheckout({ session, onEvent }: CheckoutSurfaceProps) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const openedRef = useRef(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    let cancelled = false

    const timer = setTimeout(() => {
      if (!cancelled) onEvent({ kind: 'opening_timeout_elapsed' })
    }, OPENING_TIMEOUT_MS)

    void (async () => {
      try {
        const Razorpay = await loadRazorpayCheckout()
        if (cancelled) return
        clearTimeout(timer)
        onEvent({ kind: 'razorpay_opened', subscriptionId: session.razorpaySubscriptionId })

        const rzp = new Razorpay({
          key: session.razorpayKeyId,
          subscription_id: session.razorpaySubscriptionId,
          name: APP_NAME,
          method: { upi: true },
          prefill: buildPrefill(user),
          theme: { color: '#0f3638', backdrop_color: getRazorpayBackdropColor() },
          handler: (resp: RazorpayHandlerResponse) => {
            if (!cancelled && resp?.razorpay_payment_id) {
              onEvent({ kind: 'handler_fired', subscriptionId: session.razorpaySubscriptionId })
            }
          },
          modal: {
            ondismiss: () => {
              if (!cancelled) onEvent({ kind: 'dismiss_observed', reason: 'ondismiss' })
            },
          },
        })
        rzp.open()
      } catch {
        if (cancelled) return
        clearTimeout(timer)
        setLoadFailed(true)
        onEvent({ kind: 'checkout_error', errorCode: 'NETWORK' })
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loadFailed) {
    return (
      <div className="checkout-surface-fallback">
        <p className="text-[var(--fs-sm)] text-[var(--color-text-secondary)]">
          {t.checkoutLoadFailed}
        </p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          {t.tryAgain}
        </Button>
      </div>
    )
  }

  return <Skeleton height="10rem" borderRadius="var(--radius-xl)" />
}
