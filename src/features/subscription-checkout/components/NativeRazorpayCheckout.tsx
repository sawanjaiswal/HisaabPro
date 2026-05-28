/**
 * NativeRazorpayCheckout — Capacitor Android surface.
 *
 * Wraps the official `capacitor-razorpay` plugin (registered as 'Checkout').
 * The native Android SDK launches UPI via Android Intent (GPay/PhonePe/Paytm)
 * — the ONLY way to get UPI on Android, because checkout.js disables UPI Intent
 * inside any WebView (its `; wv)` UA check).
 *
 * Capacitor auto-discovers the plugin at `cap sync`; no MainActivity.java edit
 * is needed (PLATFORM_SHELL C3 preserved). The plugin's bundled TS types are
 * loose ({key, amount}); at runtime it forwards the full options blob, so we
 * declare the real subscription-flow shape here.
 *
 * Webhook→FSM is SSOT: on resolve we dispatch `handler_fired` and let the page
 * poll the server for activation — the native callback never grants entitlement.
 */

import { useEffect, useRef } from 'react'
import { registerPlugin } from '@capacitor/core'
import { useAuth } from '@/context/AuthContext'
import { APP_NAME } from '@/config/app.config'
import { Skeleton } from '@/components/feedback/Skeleton'
import type {
  CheckoutSurfaceProps,
  RazorpayHandlerResponse,
} from '../subscription-checkout.types'

interface NativeCheckoutOptions {
  key: string
  subscription_id: string
  name?: string
  description?: string
  theme?: { color?: string }
  prefill?: { name?: string; contact?: string; email?: string }
}

interface NativeCheckoutResponse {
  response: RazorpayHandlerResponse
}

interface NativeCheckoutPlugin {
  open(options: NativeCheckoutOptions): Promise<NativeCheckoutResponse>
}

const RazorpayCheckout = registerPlugin<NativeCheckoutPlugin>('Checkout')

function buildPrefill(
  user: { name: string | null; phone: string; email: string | null } | null,
): NativeCheckoutOptions['prefill'] {
  if (!user) return undefined
  const prefill: NonNullable<NativeCheckoutOptions['prefill']> = {}
  if (user.name) prefill.name = user.name
  if (user.phone) prefill.contact = user.phone
  if (user.email) prefill.email = user.email
  return Object.keys(prefill).length > 0 ? prefill : undefined
}

export function NativeRazorpayCheckout({ session, onEvent }: CheckoutSurfaceProps) {
  const { user } = useAuth()
  const openedRef = useRef(false)

  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    let cancelled = false

    onEvent({ kind: 'razorpay_opened', subscriptionId: session.razorpaySubscriptionId })

    void (async () => {
      try {
        const result = await RazorpayCheckout.open({
          key: session.razorpayKeyId,
          subscription_id: session.razorpaySubscriptionId,
          name: APP_NAME,
          theme: { color: '#0f3638' },
          prefill: buildPrefill(user),
        })
        if (cancelled) return
        if (result?.response?.razorpay_payment_id) {
          onEvent({ kind: 'handler_fired', subscriptionId: session.razorpaySubscriptionId })
        } else {
          onEvent({ kind: 'checkout_error', errorCode: 'PAYMENT_FAILED' })
        }
      } catch {
        // Plugin rejects on user-dismiss, decline, or network failure.
        if (!cancelled) onEvent({ kind: 'dismiss_observed', reason: 'ondismiss' })
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Skeleton height="10rem" borderRadius="var(--radius-xl)" />
}
