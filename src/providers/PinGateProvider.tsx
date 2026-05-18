/**
 * PinGateProvider — bridges api.ts's 403 PIN_REQUIRED interceptor to the
 * PinPadSheet UI.
 *
 * Lifecycle:
 *   1. On mount, register a handler with `setApi403Handler`.
 *   2. The handler captures the retry-thunk + routeClass and the outer
 *      promise's resolve/reject, then sets `pending` so the sheet opens.
 *   3. On successful PIN entry → sheet calls onSuccess → provider runs the
 *      retry thunk → outer promise resolves with the retry result.
 *   4. On cancel (X / backdrop / Cancel button) → outer promise rejects with
 *      ApiError('PIN entry cancelled', 'PIN_CANCELLED', 403) so the caller
 *      (TanStack Query mutation, form handler) can roll back optimistic state.
 *   5. On unmount, clear the handler so the api.ts interceptor falls back to
 *      the normal error path.
 *
 * The provider holds no public context value — children only need to render.
 * Components that need to *trigger* PIN entry don't talk to the provider
 * directly; they just call api() and let the interceptor do the rest.
 *
 * Placement: mount above the routed app, alongside AuthProvider. PinGate is
 * independent of auth state — the interceptor only fires for already-
 * authenticated calls (the 401 path runs first and refreshes the token).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '@/lib/api'
import { setApi403Handler } from '@/lib/api-pin-gate'
import type { PinGateHandler } from '@/lib/api-pin-gate'
import { PinPadSheet } from '@/features/pin-gate/components/PinPadSheet'
import type { PendingPinChallenge, PinRouteClass } from '@/features/pin-gate/pin-gate.types'

export interface PinGateProviderProps {
  children: ReactNode
}

/**
 * Tracks the resolver/rejecter pair for the in-flight outer promise. Stored
 * in a ref because the handler closure runs once at mount; React state would
 * be stale by the time the second 403 hit.
 */
interface Pending {
  routeClass: PinRouteClass
  retry: () => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

export function PinGateProvider({ children }: PinGateProviderProps) {
  const pendingRef = useRef<Pending | null>(null)
  const [pendingView, setPendingView] = useState<PendingPinChallenge | null>(null)

  const handleCancel = useCallback(() => {
    const current = pendingRef.current
    pendingRef.current = null
    setPendingView(null)
    if (current) {
      current.reject(new ApiError('PIN entry cancelled', 'PIN_CANCELLED', 403))
    }
  }, [])

  const handleSuccess = useCallback(() => {
    const current = pendingRef.current
    if (!current) {
      // Defensive: sheet fired success but the pending slot was already cleared
      // (rapid re-renders, double-click on Verify). Nothing to do.
      setPendingView(null)
      return
    }
    // Clear the slot BEFORE awaiting retry — a second 403 during retry needs a
    // fresh pending row, not the one we're about to drop.
    const { retry, resolve, reject } = current
    pendingRef.current = null
    setPendingView(null)
    retry().then(resolve, reject)
  }, [])

  useEffect(() => {
    const handler: PinGateHandler = <T,>(retry: () => Promise<T>, routeClass: PinRouteClass) => {
      return new Promise<T>((resolve, reject) => {
        // If a previous challenge is somehow still open (concurrent 403s on
        // two requests), reject the older one — only one sheet at a time. The
        // newer challenge takes over the UI; the older caller sees a cancel.
        const prev = pendingRef.current
        if (prev) {
          prev.reject(new ApiError('PIN entry superseded', 'PIN_CANCELLED', 403))
        }
        pendingRef.current = {
          routeClass,
          retry: retry as () => Promise<unknown>,
          resolve: resolve as (value: unknown) => void,
          reject,
        }
        setPendingView({
          routeClass,
          retry: async () => { await retry() },
          cancel: () => {},
        })
      })
    }

    setApi403Handler(handler)
    return () => {
      setApi403Handler(null)
      // If we unmount mid-challenge, reject so the caller doesn't hang forever.
      const current = pendingRef.current
      pendingRef.current = null
      if (current) {
        current.reject(new ApiError('PIN entry cancelled', 'PIN_CANCELLED', 403))
      }
    }
  }, [])

  return (
    <>
      {children}
      <PinPadSheet
        pending={pendingView}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </>
  )
}
