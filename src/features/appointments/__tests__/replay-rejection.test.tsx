/** Replay-rejection bridge — FE-2 coverage.
 *
 *  Asserts:
 *    - Toast pushed with localized template
 *    - Replay-bus listeners fired with detail payload
 *    - Sentry.captureMessage called with appointment-specific key
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const captureMessage = vi.fn()
vi.mock('@/lib/sentry', () => ({
  Sentry: { captureMessage: (...args: unknown[]) => captureMessage(...args) },
}))

import { notifyReplayRejection } from '@/lib/api-queue-replay'
import { useToastStore } from '@/hooks/useToast'
import { onReplayRejected, _resetReplayBus } from '@/lib/replay-bus'
import { SENTRY_REPLAY_REJECTED_MSG } from '@/features/appointments/appointment.constants'

describe('api-queue-replay.notifyReplayRejection', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    _resetReplayBus()
    captureMessage.mockReset()
    if (typeof window !== 'undefined') window.localStorage.setItem('language', 'en')
  })

  it('pushes a feature-aware toast when entityType=appointment', () => {
    notifyReplayRejection({
      entityType: 'appointment',
      entityLabel: 'Raju Traders @ 09:30',
      method: 'PATCH',
      path: '/appointments/abc/status',
      status: 409,
      errorCode: 'INVALID_TRANSITION',
    })
    const toasts = useToastStore.getState().toasts
    expect(toasts.length).toBe(1)
    expect(String(toasts[0].message)).toContain('Raju Traders')
    expect(toasts[0].type).toBe('error')
  })

  it('emits a replay-bus event listeners can subscribe to', () => {
    const spy = vi.fn()
    const unsub = onReplayRejected(spy)
    notifyReplayRejection({
      entityType: 'appointment',
      entityLabel: 'Priya @ 10:00',
      method: 'POST',
      path: '/appointments',
      status: 409,
      errorCode: 'SLOT_TAKEN',
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toMatchObject({
      entityType: 'appointment',
      status: 409,
      errorCode: 'SLOT_TAKEN',
    })
    unsub()
  })

  it('captures a Sentry message with the appointment-specific key (no entityLabel)', () => {
    notifyReplayRejection({
      entityType: 'appointment',
      entityLabel: 'Raju Traders',
      method: 'PATCH',
      path: '/appointments/x/status',
      status: 409,
    })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [msg, opts] = captureMessage.mock.calls[0]
    expect(msg).toBe(SENTRY_REPLAY_REJECTED_MSG)
    expect(opts.level).toBe('warning')
    expect(opts.extra).toMatchObject({ entityType: 'appointment', statusCode: 409 })
    // PII (entityLabel) must never reach Sentry.
    expect(JSON.stringify(opts.extra)).not.toContain('Raju')
  })

  it('falls back to a generic message for other entity types', () => {
    notifyReplayRejection({
      entityType: 'invoice',
      entityLabel: 'INV-1',
      method: 'POST',
      path: '/invoices',
      status: 409,
    })
    const toasts = useToastStore.getState().toasts
    expect(toasts.length).toBe(1)
    expect(toasts[0].type).toBe('error')
  })
})
