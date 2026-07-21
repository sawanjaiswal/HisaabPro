/**
 * A12 / AC-26 — no un-owned promise on the sink path, and every handler is total
 * (File #56, ARCHITECTURE §12, §5.2; B-1, N-1, N-2).
 *
 * The sink is the harness's only fire-and-forget boundary: `emit()` starts a
 * promise nobody awaits. On Node >= 15 an unhandled rejection terminates the
 * process by default, so a missing `.catch` there does not degrade observation —
 * it takes the API down on the first Postgres blip, pool timeout, or dedupe-upsert
 * race. That is a strictly worse outcome than not observing at all, which is why
 * these three assertions exist rather than a single "the row was written" test.
 *
 * Each part breaks a different layer of the containment:
 *
 *   (a) the DB rejects            → B-1: `emit()`'s terminal `.catch` owns it
 *   (b) the ERROR HANDLER throws  → N-2: a throwing handler must not re-raise
 *                                  what (a) just contained. `.catch(fn)` contains
 *                                  a rejection only if `fn` cannot throw, and
 *                                  `logger.error` is a third-party call that
 *                                  carries no such guarantee.
 *   (c) the gauge saturates       → N-1: shedding is backpressure, NOT a broken
 *                                  pipe. `sinkShed` moves; `sinkWriteFailed`
 *                                  stays 0. Only the second gates promotion, so
 *                                  conflating them would make a healthy busy
 *                                  system look like a failing one.
 *
 * In every part the caller's own value must come back correct — the harness
 * observes a query, it does not participate in it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createShadowPort } from '../prisma-shadow.js'
import logger from '../logger.js'
import type { ShadowDb, ShadowObserveInput } from '../prisma-shadow.types.js'

/** A sink whose every write REJECTS. Stats are fine — only the upsert is broken. */
function rejectingDb(): ShadowDb {
  return {
    scopedShadowDivergence: {
      upsert: async () => {
        throw new Error('connection terminated unexpectedly')
      },
      groupBy: async () => [],
      count: async () => 0,
    },
    scopedShadowStat: {
      upsert: async () => ({}),
      findMany: async () => [],
    },
  }
}

/** Divergent by construction: the caller sees 2 rows, the scoped probe sees 1. */
const divergentInput = (): ShadowObserveInput => ({
  model: 'Party',
  operation: 'findMany',
  real: Promise.resolve([{ id: 'a' }, { id: 'b' }]),
  businessId: 'biz-1',
  runScoped: async () => [{ id: 'a' }],
  argFlags: { hasInclude: false, hasBoundedWindow: false },
})

let unhandled: unknown[] = []
const onUnhandled = (err: unknown) => unhandled.push(err)

/**
 * Let the fire-and-forget chain settle AND give Node a turn to surface any
 * rejection it considers unhandled. Without the macrotask hop the spy is read
 * before the process would have fired the event, and the test passes vacuously —
 * which is the failure mode this whole file exists to avoid.
 */
async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 10))
}

describe('A12 — sink failure containment', () => {
  beforeEach(() => {
    unhandled = []
    process.on('unhandledRejection', onUnhandled)
  })

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled)
    vi.restoreAllMocks()
  })

  it('(a) 50 rejecting sink writes: no unhandled rejection, all 50 counted, caller unharmed', async () => {
    const errors = vi.spyOn(logger, 'error').mockImplementation(() => logger)
    // The real throttle, with the real gauge. Each iteration settles before the
    // next begins, so the gauge is never saturated and all 50 writes are actually
    // ATTEMPTED — a shed write is not a failed one (part (c)), and letting them
    // interleave here would quietly test the wrong branch.
    const port = createShadowPort({ db: rejectingDb(), sampleRate: 1 })

    for (let i = 0; i < 50; i++) {
      const input = divergentInput()
      await port.observe(input)
      // The caller's promise is reused, never re-executed (§4.1) — it must still
      // resolve to the caller's own rows.
      await expect(input.real).resolves.toEqual([{ id: 'a' }, { id: 'b' }])
      await settle()
    }

    await settle()

    expect(unhandled).toEqual([])
    const snap = port.snapshot()
    expect(snap.sinkWriteFailed).toBe(50)
    expect(snap.sinkShed).toBe(0)
    // One log line per failure — a silent counter is not an alert.
    expect(errors.mock.calls.length).toBeGreaterThanOrEqual(50)
  })

  it('(b) the error handler itself throws: still no unhandled rejection (N-2)', async () => {
    // The nastiest shape in the file. `.catch(onSinkFailure)` contains a rejection
    // only while `onSinkFailure` cannot throw; a logger that throws re-raises
    // exactly what (a) proved was contained, from inside the containment.
    vi.spyOn(logger, 'error').mockImplementation(() => {
      throw new Error('logger transport is down')
    })

    const port = createShadowPort({ db: rejectingDb(), sampleRate: 1 })

    for (let i = 0; i < 10; i++) {
      const input = divergentInput()
      await port.observe(input)
      await expect(input.real).resolves.toEqual([{ id: 'a' }, { id: 'b' }])
      await settle()
    }

    await settle()

    expect(unhandled).toEqual([])
    // The counter increments BEFORE the throwing log call, so the failures are
    // still counted even though reporting them failed.
    expect(port.snapshot().sinkWriteFailed).toBe(10)
  })

  it('(c) a saturated gauge sheds without recording a write failure (N-1)', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => logger)

    // A throttle that always refuses a sink slot. Backpressure, not breakage:
    // nothing was attempted, so nothing can have failed.
    const port = createShadowPort({
      db: rejectingDb(),
      sampleRate: 1,
      throttle: {
        shouldSample: () => true,
        enterProbe: () => true,
        exitProbe: () => {},
        enterSink: () => false,
        exitSink: () => {},
        recordLatency: () => {},
        recordError: () => {},
        snapshot: () => ({
          breaker: 'closed',
          throttleFactor: 1,
          probeInflight: 0,
          sinkInflight: 2,
          latencyEwmaMs: 0,
          throttled: 0,
        }),
      },
    })

    for (let i = 0; i < 5; i++) {
      await port.observe(divergentInput())
    }
    await settle()

    const snap = port.snapshot()
    expect(snap.sinkShed).toBe(5)
    // The load-bearing half: shed writes must never be reported as broken ones.
    // Summing the two is what would turn a busy hour into a false promotion block.
    expect(snap.sinkWriteFailed).toBe(0)
    expect(unhandled).toEqual([])
  })
})
