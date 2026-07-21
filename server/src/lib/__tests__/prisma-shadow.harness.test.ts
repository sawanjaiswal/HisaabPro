/**
 * File #25 — AC-4 four-point injection + AC-26 + AC-29.
 *
 * The question this file answers is not "does the harness work" but "can the
 * harness hurt the caller". Every test below breaks the harness on purpose and
 * asserts the caller's value came back anyway, and that the process did not die.
 *
 * `unhandledRejection` is asserted directly rather than trusted. On Node >= 15 the
 * default mode is `throw`, so a promise the harness abandons without a terminal
 * handler kills the API on the first transient sink failure — a Postgres blip, a
 * pool timeout, a unique-constraint race on the dedupe upsert. A test that only
 * checked "the record was written" would pass on a version of this code that
 * crashes production on its first bad night.
 *
 * SCOPE of what is NOT here, stated so the gap is not mistaken for coverage: the
 * branch inside `$allOperations` (points 1 and 3 of AC-4 at the extension level)
 * needs a real Prisma client and lands with the shadow integration suite. What is
 * covered here is `observe()`'s total containment and the setter's guards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createShadowPort } from '../prisma-shadow.js'
import type { ShadowDb, ShadowObserveInput } from '../prisma-shadow.types.js'

function fakeDb(over: Partial<ShadowDb> = {}): { db: ShadowDb; upserts: unknown[]; bumps: unknown[] } {
  const upserts: unknown[] = []
  const bumps: unknown[] = []
  const db: ShadowDb = {
    scopedShadowDivergence: {
      upsert: async (a: unknown) => {
        upserts.push(a)
        return {}
      },
      groupBy: async () => [],
      count: async () => 0,
    },
    scopedShadowStat: {
      upsert: async (a: unknown) => {
        bumps.push(a)
        return {}
      },
      findMany: async () => [],
    },
    ...over,
  }
  return { db, upserts, bumps }
}

const input = (over: Partial<ShadowObserveInput> = {}): ShadowObserveInput => ({
  model: 'Party',
  operation: 'findMany',
  real: Promise.resolve([{ id: 'a' }]),
  businessId: 'biz-1',
  runScoped: async () => [{ id: 'a' }],
  argFlags: { hasInclude: false, hasBoundedWindow: false },
  ...over,
})

/** Fails the test if ANY promise escapes the harness unhandled. */
let unhandled: unknown[] = []
const onUnhandled = (err: unknown) => unhandled.push(err)

beforeEach(() => {
  unhandled = []
  process.on('unhandledRejection', onUnhandled)
})
afterEach(async () => {
  // Let any abandoned promise settle before the listener comes off, otherwise a
  // real leak lands after the assertion and the test passes for the wrong reason.
  await new Promise((r) => setTimeout(r, 10))
  process.off('unhandledRejection', onUnhandled)
  expect(unhandled).toEqual([])
})

describe('observe() — total containment (AC-4)', () => {
  it('a rejecting sink does not reject observe and does not kill the process (AC-26)', async () => {
    const { db } = fakeDb({
      scopedShadowDivergence: {
        upsert: async () => {
          throw new Error('pool timeout')
        },
        groupBy: async () => [],
        count: async () => 0,
      },
    })
    const port = createShadowPort({ db, sampleRate: 1 })

    // Force a divergence so the sink is actually exercised.
    await expect(
      port.observe(input({ runScoped: async () => [{ id: 'b' }] })),
    ).resolves.toBeUndefined()

    await new Promise((r) => setTimeout(r, 10))
    expect(port.snapshot().sinkWriteFailed).toBe(1)
  })

  it('a throwing runScoped is counted as shadow-error, not propagated', async () => {
    const { db, upserts } = fakeDb()
    const port = createShadowPort({ db, sampleRate: 1 })

    await expect(
      port.observe(
        input({
          runScoped: async () => {
            throw new Error('probe exploded')
          },
        }),
      ),
    ).resolves.toBeUndefined()

    const rec = upserts[0] as { create: { kind: string; errorName: string } }
    expect(rec.create.kind).toBe('shadow-error')
    // Name only — err.message from Prisma embeds the failing field VALUES.
    expect(rec.create.errorName).toBe('Error')
  })

  it("a rejecting `real` produces no record at all — there is nothing to compare", async () => {
    const { db, upserts, bumps } = fakeDb()
    const port = createShadowPort({ db, sampleRate: 1 })
    const real = Promise.reject(new Error('caller query failed'))
    real.catch(() => {}) // the caller owns this rejection; we only observe it

    await expect(port.observe(input({ real }))).resolves.toBeUndefined()
    expect(upserts).toEqual([])
    expect(bumps).toEqual([])
  })

  it('a throwing terminal handler is still contained (N-2)', async () => {
    const { db } = fakeDb({
      scopedShadowStat: {
        upsert: async () => {
          throw new Error('stats down')
        },
        findMany: async () => [],
      },
    })
    const port = createShadowPort({ db, sampleRate: 1 })
    // Clean comparison → emitStatsOnly → the failing path is the LAST handler.
    await expect(port.observe(input())).resolves.toBeUndefined()
    await new Promise((r) => setTimeout(r, 10))
    expect(port.snapshot().sinkWriteFailed).toBe(1)
  })
})

describe('observe() — the no-context branch (AA-5)', () => {
  it('never runs a probe when businessId is absent', async () => {
    const { db, upserts } = fakeDb()
    const runScoped = vi.fn(async () => [{ id: 'a' }])
    const port = createShadowPort({ db, sampleRate: 1 })

    await port.observe(input({ businessId: undefined, runScoped }))

    // The whole point: a probe with businessId undefined builds
    // `where: { businessId: undefined }`, Prisma DROPS the key, the probe runs
    // unscoped, the diff is empty, and the record certifies the read as clean.
    expect(runScoped).not.toHaveBeenCalled()
    expect((upserts[0] as { create: { kind: string } }).create.kind).toBe('no-context')
  })
})

describe('observe() — a clean comparison writes no divergence row (RS-1)', () => {
  it('bumps observed-framed and leaves the anomaly table untouched', async () => {
    const { db, upserts, bumps } = fakeDb()
    const port = createShadowPort({ db, sampleRate: 1 })

    await port.observe(input())
    await new Promise((r) => setTimeout(r, 10))

    expect(upserts).toEqual([])
    // Exit criterion 2 counts THIS population. Based on the divergence table it
    // would read near-zero during exactly the outcome it certifies.
    const kinds = bumps.map((b) => (b as { create: { kind: string } }).create.kind)
    expect(kinds).toContain('observed-framed')
    expect(kinds).toContain('sampled')
  })
})

describe('setShadowPort — mode guard and one-shot (AC-29)', () => {
  const prev = process.env.SCOPED_PRISMA_ENFORCE
  afterEach(() => {
    process.env.SCOPED_PRISMA_ENFORCE = prev
  })

  it('refuses to install outside shadow mode', async () => {
    process.env.SCOPED_PRISMA_ENFORCE = 'enforce'
    const { setShadowPort } = await import('../prisma-scoped.js')
    const { db } = fakeDb()
    expect(() => setShadowPort(createShadowPort({ db, sampleRate: 1 }))).toThrow(/not "shadow"/)
  })

  it('refuses a second install', async () => {
    process.env.SCOPED_PRISMA_ENFORCE = 'shadow'
    const { setShadowPort } = await import('../prisma-scoped.js')
    const { db } = fakeDb()
    setShadowPort(createShadowPort({ db, sampleRate: 1 }))
    expect(() => setShadowPort(createShadowPort({ db, sampleRate: 1 }))).toThrow(/already installed/)
  })
})
