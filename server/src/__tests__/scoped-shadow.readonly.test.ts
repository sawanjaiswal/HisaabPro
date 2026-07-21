/**
 * A10 + A11 — the harness is read-only by construction, and a context-free read
 * is never certified clean (File #45, ARCHITECTURE §12; AC-5, AC-9, AC-14, AC-23).
 *
 * Both assertions are about what the harness DOESN'T do, which is the shape most
 * easily faked. A test that samples nothing satisfies "no writes were issued"
 * perfectly. So every case here pairs its negative with a positive control from
 * the same run: the read ops must go through on the same spy that the write ops
 * must not reach. Without that pairing, deleting `shouldShadow`'s body and
 * returning `false` would turn this file green.
 *
 * Why the extension is driven directly rather than through a real client:
 * `Prisma.defineExtension(d)` returns `client => client.$extends(d)`, so handing
 * it a stub whose `$extends` captures its argument yields the very descriptor
 * Prisma would install — `$allOperations` below is the production function, not a
 * copy of it. Calling it with a synthetic `{ model, operation, args, query }`
 * exercises the real dispatch with the pool and the schema taken out of the
 * question. A1/A2 (`scoped-shadow.integration.test.ts`) cover the wiring against
 * a real database; duplicating that here would buy nothing and cost a Postgres.
 *
 * FM-16 is the failure this file is most alert to: the read-only mechanism is
 * itself the most likely cause of the silent death it exists to prevent. Exclude
 * one op too many and the harness observes nothing while every dashboard reads
 * healthy.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createScopingExtension } from '../lib/prisma-scoped.js'
import { createShadowPort } from '../lib/prisma-shadow.js'
import { setShadowPort } from '../lib/prisma-scoped.shadow.js'
import { runInBusinessContext } from '../lib/business-context.js'
import { SHADOW_READ_OPS, SHADOW_UNCOMPARABLE_OPS } from '../lib/prisma-shadow.constants.js'
import type { ShadowObserveInput, ShadowPort } from '../lib/prisma-shadow.types.js'

/** Every write operation Prisma exposes on a model delegate. */
const WRITE_OPS = [
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]

const MODEL = 'Party'
const BUSINESS_ID = 'biz-readonly-1'

/** Observations the port was asked to make, with the probe deferred to the test. */
const observed: ShadowObserveInput[] = []

/**
 * A port that records the call and — crucially — RUNS the probe.
 *
 * A port that only recorded would make "no scoped query was issued for a write"
 * true of every op, including the reads, and A10 would pass against a harness
 * that had been disabled entirely.
 */
const port: ShadowPort = {
  shouldSample: () => true,
  observe: async (input) => {
    observed.push(input)
    try {
      // UNCONDITIONALLY, including when `businessId` is undefined. Re-implementing
      // observe()'s no-context guard here would make A11 assert this stub rather
      // than the harness; running the probe regardless is what lets §4.3's belt
      // (`runScopedProbe` throwing ShadowProbeNoContext) be the thing that keeps
      // the delegate untouched.
      await input.runScoped(input.businessId as string)
    } catch {
      // The probe's own failure is not this file's subject; the delegate spy
      // below records the attempt either way.
    }
  },
  countHarnessError: () => {},
  snapshot: () => {
    throw new Error('not used by these assertions')
  },
}

/** Records every delegate method the probe re-dispatches onto. */
const delegateCalls: { model: string; operation: string }[] = []

function spyDelegate(model: string): Record<string, (args: unknown) => Promise<unknown>> {
  return new Proxy(
    {},
    {
      get: (_t, operation: string) => async (_args: unknown) => {
        delegateCalls.push({ model, operation })
        return []
      },
    },
  )
}

const innerClient = new Proxy({} as Record<string, unknown>, {
  get: (_t, model: string) => spyDelegate(model),
})

let dispatch: (ctx: {
  model: string
  operation: string
  args: unknown
  query: (args: unknown) => Promise<unknown>
}) => Promise<unknown>

beforeAll(() => {
  // Mode is `shadow` for the whole worker (vitest.shadow.config.ts) — §12.1: the
  // mode is read once at module load, so it can never be set from inside a test.
  setShadowPort(port)

  let descriptor: { query: { $allModels: { $allOperations: typeof dispatch } } } | undefined
  const apply = createScopingExtension(() => innerClient as never) as unknown as (client: {
    $extends: (d: typeof descriptor) => unknown
  }) => unknown
  apply({
    $extends: (d) => {
      descriptor = d
      return null
    },
  })
  if (!descriptor) throw new Error('createScopingExtension did not yield a descriptor')
  dispatch = descriptor.query.$allModels.$allOperations
})

/** Run one operation through the extension and let the fire-and-forget settle. */
async function runOp(operation: string, opts: { withContext?: boolean } = {}): Promise<unknown> {
  const caller = vi.fn(async () => [{ id: 'caller-row' }])
  const invoke = () => dispatch({ model: MODEL, operation, args: {}, query: caller })
  const result = opts.withContext === false
    ? await invoke()
    : await runInBusinessContext({ businessId: BUSINESS_ID, userId: 'u1' }, invoke)
  await new Promise((r) => setTimeout(r, 10))
  return result
}

function reset(): void {
  observed.length = 0
  delegateCalls.length = 0
}

describe('A10 — read-only by construction (AC-5, AC-14)', () => {
  it('every write op reaches the caller and NOTHING else', async () => {
    for (const op of WRITE_OPS) {
      reset()
      await runOp(op)
      expect(observed, `${op} was observed by the harness`).toHaveLength(0)
      expect(delegateCalls, `${op} issued a scoped query: ${JSON.stringify(delegateCalls)}`).toHaveLength(0)
    }
  })

  it('count / aggregate / groupBy are excluded — scalars have nothing to diff', async () => {
    for (const op of SHADOW_UNCOMPARABLE_OPS) {
      reset()
      await runOp(op)
      expect(observed, `${op} was observed`).toHaveLength(0)
      expect(delegateCalls, `${op} issued a scoped query`).toHaveLength(0)
    }
  })

  it('the positive control: every read op IS observed and DOES issue a scoped query', async () => {
    // The half that makes the two cases above mean something. If this ever goes
    // red, the harness has gone silent and the negatives are vacuous — which is
    // FM-16 exactly, and it looks like a healthy system from every other angle.
    expect(SHADOW_READ_OPS.size).toBeGreaterThan(0)
    for (const op of SHADOW_READ_OPS) {
      reset()
      await runOp(op)
      expect(observed, `read op ${op} was not observed`).toHaveLength(1)
      expect(delegateCalls.length, `read op ${op} issued no scoped query`).toBeGreaterThan(0)
    }
  })

  it('no read op is also a write op — the two sets cannot overlap', () => {
    // The sets are derived by subtraction from the injector's own view of a read
    // (`READ_MERGE_OPS ∪ FIND_UNIQUE_OPS`), so this asserts the derivation, not a
    // hand-maintained list. An upstream edit that classified `updateMany` as a
    // read would fail here before it could double-execute a write in production.
    for (const op of WRITE_OPS) expect(SHADOW_READ_OPS.has(op)).toBe(false)
  })
})

describe('A11 — the no-context branch is taken (AC-23)', () => {
  it('§4.3 belt: a probe reached without a tenant frame issues ZERO scoped queries', async () => {
    reset()
    await runOp('findMany', { withContext: false })

    // Observed — the harness must SEE the read; it is the probe that must not run.
    expect(observed).toHaveLength(1)
    expect(observed[0]!.businessId).toBeUndefined()

    // The load-bearing assertion. Before these guards existed, the probe ran with
    // `businessId: undefined`, Prisma DROPPED the key from the where clause, the
    // scoped side came back identical to the unscoped side, and the record
    // certified a context-free read as non-divergent. With no `runUnscoped`
    // adopters that is ~100% of cron and pre-business traffic marking itself
    // clean — the epic's own catastrophic outcome (b), reported as success.
    expect(delegateCalls, `probe ran without a tenant frame: ${JSON.stringify(delegateCalls)}`).toHaveLength(0)
  })

  it('the REAL observe() short-circuits before the probe and records exactly one no-context row', async () => {
    // The primary control, asserted against the real harness rather than the stub
    // above. `createShadowPort` is called directly because `setShadowPort` is
    // one-shot by design (M-2) — there is deliberately no reset export, so the
    // second port in this file is constructed instead of installed.
    const written: { kind: string; subjectBusinessId: string | null }[] = []
    const realPort = createShadowPort({
      sampleRate: 1,
      db: {
        scopedShadowDivergence: {
          upsert: async (args: { create: { kind: string; subjectBusinessId: string | null } }) => {
            written.push(args.create)
            return {}
          },
          groupBy: async () => [],
          count: async () => 0,
        },
        scopedShadowStat: { upsert: async () => ({}), findMany: async () => [] },
      } as never,
    })

    const runScoped = vi.fn(async () => [])
    await realPort.observe({
      model: MODEL,
      operation: 'findMany',
      real: Promise.resolve([{ id: 'a' }]),
      businessId: undefined,
      runScoped,
      argFlags: { hasInclude: false, hasBoundedWindow: false },
    })
    await new Promise((r) => setTimeout(r, 10))

    expect(runScoped).not.toHaveBeenCalled()
    expect(written).toHaveLength(1)
    expect(written[0]!.kind).toBe('no-context')
    // FM-13: the row that says "this read had no tenant" must not itself carry a
    // tenant id. There is none to carry here, and the record must say so rather
    // than inventing one.
    expect(written[0]!.subjectBusinessId).toBeNull()
  })

  it('the caller still gets its own unscoped result', async () => {
    reset()
    const result = await runOp('findMany', { withContext: false })
    // Shadow mode changes observation, never behaviour. A no-context read that
    // started failing here would be the harness participating in the query.
    expect(result).toEqual([{ id: 'caller-row' }])
  })
})
