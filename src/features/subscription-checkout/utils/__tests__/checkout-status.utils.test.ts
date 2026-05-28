/**
 * Checkout FSM proofs. The load-bearing invariant is N3: the machine may ONLY
 * enter `success` when the status poll observes a PAID subscriptionState — the
 * Razorpay handler callback alone (handler_fired) must never grant entitlement.
 */

import { describe, it, expect } from 'vitest'
import { nextPhase, initialPhase, isTerminal } from '../checkout-status.utils'
import type { CheckoutPhase } from '../subscription-checkout.types'

const polling: CheckoutPhase = { kind: 'polling', subscriptionId: 'sub_1', startedAt: 0 }

describe('checkout FSM — happy path', () => {
  it('idle → opening → authorising → polling', () => {
    let p = initialPhase()
    p = nextPhase(p, { kind: 'open_clicked' })
    expect(p.kind).toBe('opening')
    p = nextPhase(p, { kind: 'razorpay_opened', subscriptionId: 'sub_1' })
    expect(p.kind).toBe('authorising')
    p = nextPhase(p, { kind: 'handler_fired', subscriptionId: 'sub_1' })
    expect(p.kind).toBe('polling')
  })
})

describe('N3 — success requires a PAID poll observation', () => {
  it('handler_fired alone does NOT reach success', () => {
    const authorising: CheckoutPhase = { kind: 'authorising', subscriptionId: 'sub_1' }
    const p = nextPhase(authorising, { kind: 'handler_fired', subscriptionId: 'sub_1' })
    expect(p.kind).toBe('polling')
    expect(p.kind).not.toBe('success')
  })

  it('poll observing a non-paid state stays in polling (no premature success)', () => {
    const p = nextPhase(polling, { kind: 'poll_active', state: 'NONE' })
    expect(p.kind).toBe('polling')
  })

  it.each(['ACTIVE', 'TRIAL_AUTOPAY'] as const)('poll observing %s → success', (state) => {
    const p = nextPhase(polling, { kind: 'poll_active', state })
    expect(p).toEqual({ kind: 'success', state })
  })

  it('PAST_DUE / LOCKED do not count as success', () => {
    expect(nextPhase(polling, { kind: 'poll_active', state: 'PAST_DUE' }).kind).toBe('polling')
    expect(nextPhase(polling, { kind: 'poll_active', state: 'LOCKED' }).kind).toBe('polling')
  })
})

describe('checkout FSM — failure & recovery', () => {
  it('poll_timeout → stranded, retry re-enters polling with the same sub', () => {
    const stranded = nextPhase(polling, { kind: 'poll_timeout' })
    expect(stranded).toEqual({ kind: 'stranded', subscriptionId: 'sub_1' })
    const retried = nextPhase(stranded, { kind: 'user_retry' })
    expect(retried.kind).toBe('polling')
  })

  it('dismiss while opening → cancelled (terminal)', () => {
    const opening: CheckoutPhase = { kind: 'opening', startedAt: 0 }
    const p = nextPhase(opening, { kind: 'dismiss_observed', reason: 'ondismiss' })
    expect(p).toEqual({ kind: 'cancelled', reason: 'ondismiss' })
    expect(isTerminal(p)).toBe(true)
  })

  it('opening timeout → failed(NETWORK)', () => {
    const opening: CheckoutPhase = { kind: 'opening', startedAt: 0 }
    expect(nextPhase(opening, { kind: 'opening_timeout_elapsed' })).toEqual({
      kind: 'failed',
      errorCode: 'NETWORK',
    })
  })

  it('reset returns to idle from any phase', () => {
    expect(nextPhase(polling, { kind: 'reset' })).toEqual({ kind: 'idle' })
  })
})
