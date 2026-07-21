/**
 * File #11 — sampler, gauges, EWMA, breaker. No DB (ARCHITECTURE §5.2, AC-11).
 *
 * Clock and RNG are injected, so the 60-second breaker window and the 5-minute
 * cooldown are asserted in microseconds rather than skipped. A breaker whose
 * timing can only be tested by sleeping does not get tested, and an untested
 * breaker is exactly the "landed dark" failure this epic was written about.
 */
import { describe, it, expect } from 'vitest'
import { createShadowThrottle } from '../prisma-shadow.throttle.js'
import {
  SHADOW_BREAKER_COOLDOWN_MS,
  SHADOW_BREAKER_ERRORS,
  SHADOW_BREAKER_WINDOW_MS,
  SHADOW_LATENCY_TARGET_MS,
  SHADOW_MAX_INFLIGHT,
  SHADOW_SINK_MAX_INFLIGHT,
  SHADOW_THROTTLE_RESUME,
} from '../prisma-shadow.constants.js'

/** Deterministic clock. `t` is advanced by the test, never by wall time. */
function makeClock() {
  let t = 1_000_000
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

const always = () => 0 // random() < rate is true for any positive rate
const never = () => 0.999999

describe('throttle — sampler', () => {
  it('sampleRate 0 never samples', () => {
    const th = createShadowThrottle({ sampleRate: 0, random: always })
    expect(th.shouldSample()).toBe(false)
  })

  it('sampleRate 1 samples when nothing else objects', () => {
    const th = createShadowThrottle({ sampleRate: 1, random: always })
    expect(th.shouldSample()).toBe(true)
  })

  it('respects the dice roll', () => {
    const th = createShadowThrottle({ sampleRate: 0.5, random: never })
    expect(th.shouldSample()).toBe(false)
  })
})

describe('throttle — probe inflight gauge (FM-8)', () => {
  it('refuses sampling once the probe cap is reached', () => {
    const th = createShadowThrottle({ sampleRate: 1, random: always })
    for (let i = 0; i < SHADOW_MAX_INFLIGHT; i += 1) expect(th.enterProbe()).toBe(true)

    expect(th.enterProbe()).toBe(false)
    expect(th.shouldSample()).toBe(false)
    // Recorded as throttling, not lost in the sampler's noise — the ramp reads
    // this number to tell "quiet" apart from "saturated".
    expect(th.snapshot().throttled).toBe(1)

    th.exitProbe()
    expect(th.shouldSample()).toBe(true)
  })

  it('exitProbe never underflows', () => {
    const th = createShadowThrottle({ sampleRate: 1 })
    th.exitProbe()
    expect(th.snapshot().probeInflight).toBe(0)
  })
})

describe('throttle — sink inflight gauge (B-2)', () => {
  it('sheds rather than queues when saturated', () => {
    const th = createShadowThrottle({ sampleRate: 1 })
    for (let i = 0; i < SHADOW_SINK_MAX_INFLIGHT; i += 1) expect(th.enterSink()).toBe(true)
    expect(th.enterSink()).toBe(false)

    th.exitSink()
    expect(th.enterSink()).toBe(true)
  })

  it('the sink gauge is independent of the probe gauge', () => {
    const th = createShadowThrottle({ sampleRate: 1 })
    for (let i = 0; i < SHADOW_SINK_MAX_INFLIGHT; i += 1) th.enterSink()
    expect(th.enterProbe()).toBe(true)
  })
})

describe('throttle — latency EWMA (FM-10)', () => {
  it('sustained slow probes decay throttleFactor toward zero', () => {
    // A fixed roll of 0.05: admitted at full rate, refused once the effective
    // rate has decayed below it. Asserting a flat `false` would be wrong — a
    // decayed factor still samples proportionally, which is the intended shape.
    const th = createShadowThrottle({ sampleRate: 1, random: () => 0.05 })
    expect(th.shouldSample()).toBe(true)

    for (let i = 0; i < 40; i += 1) th.recordLatency(SHADOW_LATENCY_TARGET_MS * 10)

    expect(th.snapshot().throttleFactor).toBeLessThan(0.01)
    expect(th.shouldSample()).toBe(false)
  })

  it('recovers additively once latency returns under half the target', () => {
    const th = createShadowThrottle({ sampleRate: 1, random: always })
    for (let i = 0; i < 40; i += 1) th.recordLatency(SHADOW_LATENCY_TARGET_MS * 10)
    const floor = th.snapshot().throttleFactor

    for (let i = 0; i < 200; i += 1) th.recordLatency(1)
    const recovered = th.snapshot().throttleFactor

    expect(recovered).toBeGreaterThan(floor)
    expect(recovered).toBeLessThanOrEqual(1)
  })
})

describe('throttle — error breaker (AC-11, FM-9)', () => {
  it('opens at the error threshold inside the window', () => {
    const clock = makeClock()
    const th = createShadowThrottle({ sampleRate: 1, random: always, now: clock.now })

    for (let i = 0; i < SHADOW_BREAKER_ERRORS - 1; i += 1) th.recordError()
    expect(th.snapshot().breaker).toBe('closed')

    th.recordError()
    expect(th.snapshot().breaker).toBe('open')
    expect(th.shouldSample()).toBe(false)
  })

  it('errors aging out of the window do not accumulate', () => {
    const clock = makeClock()
    const th = createShadowThrottle({ sampleRate: 1, random: always, now: clock.now })

    for (let i = 0; i < SHADOW_BREAKER_ERRORS - 1; i += 1) th.recordError()
    clock.advance(SHADOW_BREAKER_WINDOW_MS + 1)
    th.recordError()

    // A trickle of errors over hours is not the failure the breaker guards.
    expect(th.snapshot().breaker).toBe('closed')
  })

  it('resumes at a fraction of full rate after the cooldown, not at 1', () => {
    const clock = makeClock()
    const th = createShadowThrottle({ sampleRate: 1, random: always, now: clock.now })
    for (let i = 0; i < SHADOW_BREAKER_ERRORS; i += 1) th.recordError()

    clock.advance(SHADOW_BREAKER_COOLDOWN_MS - 1)
    expect(th.snapshot().breaker).toBe('open')

    clock.advance(2)
    const after = th.snapshot()
    expect(after.breaker).toBe('closed')
    // Whatever tripped the breaker is usually still partly true.
    expect(after.throttleFactor).toBe(SHADOW_THROTTLE_RESUME)
    expect(th.shouldSample()).toBe(true)
  })
})
