/**
 * PinPadSheet — bottom-sheet / centered-modal wrapper around <PinPad>.
 *
 * Behaviour:
 *   - Opens via the `pending` prop (provider drops it in on 403 PIN_REQUIRED).
 *   - Calls onSuccess() once the PIN is verified (server has set the fresh
 *     grace cookie at that point — the provider then runs the retry thunk).
 *   - Calls onCancel() on backdrop click / X / Cancel button. The provider
 *     rejects the outer api() promise on cancel so callers can roll back
 *     optimistic state.
 *   - Auto-submits at PIN_MAX_LEN; explicit Verify button covers short PINs.
 *   - Three error surfaces: wrong PIN (shake + clear), locked (countdown +
 *     disabled keypad), offline (banner + disabled submit).
 *
 * Hosted in <Drawer> — Drawer already provides bottom-sheet on mobile /
 * centered-modal on desktop via its CSS, plus safe-area insets, focus trap,
 * scroll lock and the close X. PinPadSheet never touches --safe-area-inset-*.
 */

import { useCallback, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { PinPad } from './PinPad'
import { usePinKeypad } from '../hooks/usePinKeypad'
import { usePinSheetState } from '../hooks/usePinSheetState'
import {
  KEYPAD_BACKSPACE,
  PIN_MAX_LEN,
  PIN_MIN_LEN,
  ROUTE_CLASS_TITLE_KEY,
} from '../pin-gate.constants'
import type { PendingPinChallenge, PinRouteClass } from '../pin-gate.types'
import './pin-pad-sheet.css'

export interface PinPadSheetProps {
  pending: PendingPinChallenge | null
  onSuccess: () => void
  onCancel: () => void
}

export function PinPadSheet({ pending, onSuccess, onCancel }: PinPadSheetProps) {
  const { t } = useLanguage()
  const { value, append, backspace, clear } = usePinKeypad(PIN_MAX_LEN)
  const { error, submitting, submit, reset, clearWrongError } = usePinSheetState({
    active: pending !== null,
    onSuccess,
  })

  const routeClass: PinRouteClass = pending?.routeClass ?? 'mutation'
  const titleKey = ROUTE_CLASS_TITLE_KEY[routeClass] as keyof typeof t
  const title = (t[titleKey] as string) ?? t.pinPadTitleMutation

  // Reset state every time a fresh challenge arrives.
  useEffect(() => {
    if (pending) { clear(); reset() }
  }, [pending, clear, reset])

  const handleSubmit = useCallback(() => {
    if (value.length < PIN_MIN_LEN) return
    void submit(value).then(() => { clear() })
  }, [value, submit, clear])

  // Auto-submit when the user types the last digit.
  useEffect(() => {
    if (value.length === PIN_MAX_LEN && !submitting) handleSubmit()
  }, [value, submitting, handleSubmit])

  const handleKey = useCallback(
    (key: string) => {
      if (submitting || error?.kind === 'locked') return
      clearWrongError()
      if (key === KEYPAD_BACKSPACE) backspace()
      else append(key)
    },
    [append, backspace, submitting, error, clearWrongError],
  )

  // Physical-keyboard support for desktop.
  useEffect(() => {
    if (!pending) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); return }
      if (e.key === 'Backspace') { e.preventDefault(); handleKey(KEYPAD_BACKSPACE); return }
      if (e.key >= '0' && e.key <= '9' && e.key.length === 1) {
        e.preventDefault()
        handleKey(e.key)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pending, handleKey, handleSubmit])

  // mm:ss for the lockout banner.
  const lockedCopy = (() => {
    if (error?.kind !== 'locked') return ''
    const sec = Math.max(0, error.retryAfterSec ?? 0)
    const mm = Math.floor(sec / 60).toString().padStart(2, '0')
    const ss = (sec % 60).toString().padStart(2, '0')
    return `${t.pinPadLockedRetryIn} ${mm}:${ss}`
  })()

  const submitDisabled =
    value.length < PIN_MIN_LEN
    || submitting
    || error?.kind === 'locked'
    || error?.kind === 'offline'

  return (
    <Drawer
      open={pending !== null}
      onClose={onCancel}
      title={title}
      size="sm"
      persistent={submitting}
      footer={
        <div className="pin-pad-sheet-footer py-0">
          <Button variant="ghost" size="md" onClick={onCancel} disabled={submitting}>
            {t.pinPadCancel}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitDisabled}
          >
            {submitting ? t.pinPadVerifying : t.pinPadVerify}
          </Button>
        </div>
      }
    >
      <div className="pin-pad-sheet py-0">
        <p className="pin-pad-sheet-subtitle py-0">{t.pinPadSubtitle}</p>

        {error?.kind === 'wrong' && (
          <div role="alert" className="pin-pad-sheet-error pin-pad-sheet-error--warn py-0">
            {t.pinPadIncorrectTryAgain}
          </div>
        )}
        {error?.kind === 'locked' && (
          <div role="alert" className="pin-pad-sheet-error pin-pad-sheet-error--locked py-0">
            <span>{t.pinPadLocked}</span>
            {(error.retryAfterSec ?? 0) > 0 && (
              <span className="pin-pad-sheet-error-meta py-0">{lockedCopy}</span>
            )}
          </div>
        )}
        {error?.kind === 'offline' && (
          <div role="alert" className="pin-pad-sheet-error pin-pad-sheet-error--info py-0">
            {t.pinPadConnectionError}
          </div>
        )}
        {error?.kind === 'network' && (
          <div role="alert" className="pin-pad-sheet-error pin-pad-sheet-error--warn py-0">
            {t.pinPadConnectionError}
          </div>
        )}

        <PinPad
          value={value}
          length={PIN_MAX_LEN}
          onKeyPress={handleKey}
          error={error?.kind === 'wrong'}
          disabled={submitting || error?.kind === 'locked' || error?.kind === 'offline'}
        />

        <Button variant="none"
          type="button"
          className="pin-pad-sheet-forgot py-0"
          onClick={onCancel}
          disabled={submitting}
        >
          {t.pinPadForgotPin}
        </Button>
      </div>
    </Drawer>
  )
}
