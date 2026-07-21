/**
 * Self-limiting: sampler, inflight gauges, latency EWMA, error breaker
 * (File #7, ARCHITECTURE §4.2 cond. 7, §5.2, FM-8/9/10).
 *
 * Everything here answers one question — "may the harness spend a resource right
 * now?" — and the honest default for every arm is NO. A shadow harness that
 * degrades the production query it is observing has inverted its own purpose.
 *
 * DEVIATION from File Plan row #7, stated rather than buried: the plan has this
 * module import `env.scoped-prisma.ts` directly (D-10). It takes injected config
 * instead. Two reasons: the shadow accessors do not exist there until Phase 4
 * (row #24), and a module-load env read makes every threshold in here untestable
 * without process-level env mutation — which `vitest.shadow.config.ts` already
 * forbids for a separate reason (SS-3, `pool: 'forks'`, no parallelism). The env
 * read moves up one level to the composition root in `prisma-shadow.ts`, which is
 * where the other env-derived wiring already lands. No threshold changes.
 *
 * `now` and `random` are injected for the same reason — a breaker whose window
 * can only be tested by sleeping 60 real seconds does not get tested.
 */
import {
  SHADOW_BREAKER_COOLDOWN_MS,
  SHADOW_BREAKER_ERRORS,
  SHADOW_BREAKER_WINDOW_MS,
  SHADOW_LATENCY_ALPHA,
  SHADOW_LATENCY_TARGET_MS,
  SHADOW_MAX_INFLIGHT,
  SHADOW_SINK_MAX_INFLIGHT,
  SHADOW_THROTTLE_DECAY,
  SHADOW_THROTTLE_RECOVER,
  SHADOW_THROTTLE_RESUME,
} from './prisma-shadow.constants.js'

export interface ShadowThrottleConfig {
  /** Base sample rate, 0…1. Read from env at the composition root. */
  sampleRate: number
  now?: () => number
  random?: () => number
}

export type ShadowBreakerState = 'closed' | 'open'

export interface ShadowThrottleSnapshot {
  breaker: ShadowBreakerState
  throttleFactor: number
  probeInflight: number
  sinkInflight: number
  latencyEwmaMs: number
  /** Sampling decisions refused by an arm other than the dice roll. */
  throttled: number
}

export interface ShadowThrottle {
  /** Cheap and synchronous — called on the hot path of every candidate read. */
  shouldSample(): boolean
  /** Reserve a probe pool slot. `false` ⇒ do not probe (FM-8). */
  enterProbe(): boolean
  exitProbe(): void
  /** Reserve a sink-write slot. `false` ⇒ shed the write, never queue it (B-2). */
  enterSink(): boolean
  exitSink(): void
  recordLatency(ms: number): void
  /** Probe OR sink failure — one breaker covers both (FM-9). */
  recordError(): void
  snapshot(): ShadowThrottleSnapshot
}

export function createShadowThrottle(config: ShadowThrottleConfig): ShadowThrottle {
  const now = config.now ?? (() => Date.now())
  const random = config.random ?? Math.random
  const sampleRate = Math.min(1, Math.max(0, config.sampleRate))

  let throttleFactor = 1
  let probeInflight = 0
  let sinkInflight = 0
  let latencyEwmaMs = 0
  let throttled = 0

  /** Error timestamps inside the rolling window. Pruned on every record. */
  let errorTimes: number[] = []
  let breakerOpenedAt: number | null = null

  /**
   * The breaker is evaluated lazily on read rather than by a timer: a timer in a
   * module like this outlives the thing it was measuring and keeps a process
   * alive in tests.
   */
  function breakerState(): ShadowBreakerState {
    if (breakerOpenedAt === null) return 'closed'
    if (now() - breakerOpenedAt < SHADOW_BREAKER_COOLDOWN_MS) return 'open'
    // Cooldown elapsed. Resume at a fraction of full rate, not at 1 — whatever
    // tripped the breaker is usually still partly true.
    breakerOpenedAt = null
    errorTimes = []
    throttleFactor = SHADOW_THROTTLE_RESUME
    return 'closed'
  }

  function shouldSample(): boolean {
    if (sampleRate <= 0) return false

    if (breakerState() === 'open') {
      throttled += 1
      return false
    }

    // Checked before the dice roll so a saturated pool is recorded as throttling
    // rather than disappearing into the sampler's noise.
    if (probeInflight >= SHADOW_MAX_INFLIGHT) {
      throttled += 1
      return false
    }

    const effective = sampleRate * throttleFactor
    if (effective <= 0) {
      throttled += 1
      return false
    }

    return random() < effective
  }

  function enterProbe(): boolean {
    if (probeInflight >= SHADOW_MAX_INFLIGHT) return false
    probeInflight += 1
    return true
  }

  function exitProbe(): void {
    if (probeInflight > 0) probeInflight -= 1
  }

  function enterSink(): boolean {
    if (sinkInflight >= SHADOW_SINK_MAX_INFLIGHT) return false
    sinkInflight += 1
    return true
  }

  function exitSink(): void {
    if (sinkInflight > 0) sinkInflight -= 1
  }

  /**
   * Multiplicative decrease, additive increase. Backing off fast and recovering
   * slowly is the right asymmetry for a component whose failure mode is stealing
   * capacity from the queries it exists to observe.
   */
  function recordLatency(ms: number): void {
    latencyEwmaMs =
      latencyEwmaMs === 0 ? ms : SHADOW_LATENCY_ALPHA * ms + (1 - SHADOW_LATENCY_ALPHA) * latencyEwmaMs

    if (latencyEwmaMs > SHADOW_LATENCY_TARGET_MS) {
      throttleFactor = Math.max(0, throttleFactor * SHADOW_THROTTLE_DECAY)
    } else if (latencyEwmaMs < SHADOW_LATENCY_TARGET_MS / 2) {
      throttleFactor = Math.min(1, throttleFactor + SHADOW_THROTTLE_RECOVER)
    }
  }

  function recordError(): void {
    const t = now()
    errorTimes = errorTimes.filter((ts) => t - ts < SHADOW_BREAKER_WINDOW_MS)
    errorTimes.push(t)

    if (errorTimes.length >= SHADOW_BREAKER_ERRORS && breakerOpenedAt === null) {
      breakerOpenedAt = t
      throttleFactor = 0
    }
  }

  function snapshot(): ShadowThrottleSnapshot {
    // Via breakerState(), not the raw field: a snapshot taken after the cooldown
    // elapsed but before the next sample decision would otherwise report `open`
    // forever on a quiet system, and that snapshot is what the alert reads.
    return {
      breaker: breakerState(),
      throttleFactor,
      probeInflight,
      sinkInflight,
      latencyEwmaMs,
      throttled,
    }
  }

  return {
    shouldSample,
    enterProbe,
    exitProbe,
    enterSink,
    exitSink,
    recordLatency,
    recordError,
    snapshot,
  }
}
