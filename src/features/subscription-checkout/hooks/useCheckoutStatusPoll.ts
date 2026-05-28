/**
 * Polls GET /subscription/checkout/status while the FSM is in `polling`.
 *
 * Webhook→FSM is the SSOT: after the Razorpay handler fires we cannot trust the
 * client callback to grant entitlement, so we poll the server-written
 * subscriptionState until it reaches a paid state (→ poll_active) or the
 * 120s budget elapses (→ poll_timeout, "stranded"). Pauses while the tab is
 * hidden so a backgrounded checkout doesn't burn the budget.
 */

import { useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
} from '../subscription-checkout.constants'
import type {
  CheckoutEvent,
  CheckoutPhase,
  CheckoutStatusResponse,
} from '../subscription-checkout.types'

export function useCheckoutStatusPoll(
  phase: CheckoutPhase,
  onEvent: (event: CheckoutEvent) => void,
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const isPolling = phase.kind === 'polling'
  const startedAt = phase.kind === 'polling' ? phase.startedAt : 0

  useEffect(() => {
    if (!isPolling) return

    let cancelled = false
    const controller = new AbortController()

    async function tick() {
      if (cancelled) return
      if (document.visibilityState === 'hidden') return
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        onEventRef.current({ kind: 'poll_timeout' })
        return
      }
      try {
        const status = await api<CheckoutStatusResponse>(
          '/subscription/checkout/status',
          { signal: controller.signal },
        )
        if (!cancelled) onEventRef.current({ kind: 'poll_active', state: status.subscriptionState })
      } catch {
        // Transient — let the next interval retry until the budget elapses.
      }
    }

    void tick()
    const id = setInterval(() => void tick(), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(id)
    }
  }, [isPolling, startedAt])
}
