/**
 * usePinSheetState — orchestrates the PIN sheet's transient state.
 *
 * Owns: error kind, lockout countdown, submitting flag, online/offline edge,
 * the verify-pin call wiring, and the stale-response token guard. The sheet
 * component consumes a small surface (`{ error, submitting, submit, reset }`)
 * and stays focused on JSX + keyboard wiring.
 *
 * Pulled out of PinPadSheet.tsx so the sheet stays ≤200 LOC and so the state
 * machine is unit-testable without a portaled <Drawer>.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api'
import { verifyPin } from '../pin-gate.service'
import { LOCKOUT_TICK_MS } from '../pin-gate.constants'

export type PinSheetErrorKind = 'wrong' | 'locked' | 'offline' | 'network'

export interface PinSheetError {
  kind: PinSheetErrorKind
  /** Lockout remaining seconds — only set when kind === 'locked'. */
  retryAfterSec?: number
}

export interface UsePinSheetStateOptions {
  /** Whether the host sheet is currently open. Used to attach/detach listeners. */
  active: boolean
  /** Called after a successful verifyPin response. */
  onSuccess: () => void
  /** Called by the host whenever the value changes — used to clear "wrong PIN" state on next keystroke. */
}

export interface UsePinSheetStateResult {
  error: PinSheetError | null
  submitting: boolean
  /** Submit the given PIN. No-op when offline / locked / already submitting. */
  submit: (pin: string) => Promise<void>
  /** Imperative reset (call on sheet open / pending change). */
  reset: () => void
  /** Imperative error clear (call on next keystroke after a wrong-PIN flash). */
  clearWrongError: () => void
}

export function usePinSheetState({ active, onSuccess }: UsePinSheetStateOptions): UsePinSheetStateResult {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<PinSheetError | null>(null)
  const submitTokenRef = useRef(0)

  const reset = useCallback(() => {
    setSubmitting(false)
    setError(typeof navigator !== 'undefined' && !navigator.onLine ? { kind: 'offline' } : null)
  }, [])

  const clearWrongError = useCallback(() => {
    setError((prev) => (prev?.kind === 'wrong' ? null : prev))
  }, [])

  // Lockout countdown — clears the error when the timer expires so the user
  // can try again. Bumping the timer rules out drift across React's batching.
  useEffect(() => {
    if (!active || error?.kind !== 'locked' || (error.retryAfterSec ?? 0) <= 0) return
    const id = setInterval(() => {
      setError((prev) => {
        if (!prev || prev.kind !== 'locked') return prev
        const next = (prev.retryAfterSec ?? 0) - 1
        if (next <= 0) return null
        return { kind: 'locked', retryAfterSec: next }
      })
    }, LOCKOUT_TICK_MS)
    return () => clearInterval(id)
  }, [active, error])

  // Online/offline edge — drop the offline banner the moment connectivity returns.
  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const onOnline = () => setError((prev) => (prev?.kind === 'offline' ? null : prev))
    const onOffline = () => setError({ kind: 'offline' })
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [active])

  const submit = useCallback(
    async (pin: string) => {
      if (submitting) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError({ kind: 'offline' })
        return
      }

      // Token guard: a late response from a stale submit must not flip the
      // state of a newer one. Real-world trigger is users mashing Verify.
      const token = ++submitTokenRef.current
      setSubmitting(true)
      setError(null)
      try {
        await verifyPin(pin)
        if (token !== submitTokenRef.current) return
        onSuccess()
      } catch (err) {
        if (token !== submitTokenRef.current) return
        if (err instanceof ApiError) {
          if (err.status === 429) {
            const detail = err.detail as { retryAfter?: number } | undefined
            setError({ kind: 'locked', retryAfterSec: detail?.retryAfter ?? 0 })
          } else if (err.status === 401) {
            setError({ kind: 'wrong' })
          } else {
            setError({ kind: 'network' })
          }
        } else {
          setError({ kind: 'network' })
        }
      } finally {
        if (token === submitTokenRef.current) setSubmitting(false)
      }
    },
    [submitting, onSuccess],
  )

  return { error, submitting, submit, reset, clearWrongError }
}
