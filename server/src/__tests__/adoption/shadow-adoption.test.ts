/**
 * Adoption assertions A5–A8 (File #41, ARCHITECTURE §12).
 *
 * §12's rule: every component this epic adds carries one test that fails when the
 * CALL SITE is deleted, even though the definition still typechecks, still has
 * unit tests, and still greps. This epic exists because four components satisfied
 * all three of those and were called by nothing.
 *
 * So none of these tests import a job and run it. Each one exercises the thing
 * that is supposed to INVOKE the job (`initCronJobs`, the Express app) and
 * asserts the invocation happened — which is the only phrasing that goes red when
 * someone deletes a `cron.schedule(...)` line (AA-4).
 *
 * A5–A7 additionally invoke the CAPTURED callback rather than trusting that a
 * matching cron expression exists. A registration whose callback is `() => {}`
 * satisfies "a `15 3 * * *` entry exists" and does no retention.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'

const scheduled: { expr: string; fn: () => unknown }[] = []

vi.mock('node-cron', () => ({
  default: {
    schedule: (expr: string, fn: () => unknown) => {
      scheduled.push({ expr, fn })
      return { stop: () => {} }
    },
  },
}))

// Each job is mocked at its own module so the captured callback can be proven to
// reach it. Mocking `initCronJobs`' dependencies is the point: the assertion is
// about the wire between them, not about what the jobs compute (that is
// `jobs/__tests__/shadow-jobs.test.ts`).
const retention = vi.fn(async () => {})
const canary = vi.fn(async () => {})
const watchdog = vi.fn(async () => {})

vi.mock('../../jobs/shadow-retention.cron.js', () => ({
  runShadowRetentionJob: () => retention(),
  runShadowRetention: () => retention(),
}))
vi.mock('../../jobs/shadow-canary.cron.js', () => ({
  runShadowCanaryJob: () => canary(),
  runShadowCanary: () => canary(),
}))
vi.mock('../../jobs/shadow-watchdog.cron.js', () => ({
  runShadowWatchdogJob: () => watchdog(),
  runShadowWatchdog: () => watchdog(),
}))

/**
 * Invoke every callback registered on `expr` and report whether `spy` fired.
 *
 * Not `entries[0]` — cron expressions are NOT unique in this scheduler (the
 * every-15-minutes slot is also the recurring-invoice generator, registered
 * first), so indexing the first match asserts against whichever job happens to be
 * earlier in the file. Requiring uniqueness would be a constraint the scheduler
 * never promised; "some registration on this schedule reaches this job" is the
 * actual claim, and it survives a reorder.
 */
async function scheduleReaches(expr: string, spy: { mock: { calls: unknown[] } }): Promise<boolean> {
  const entries = scheduled.filter((s) => s.expr === expr)
  expect(entries.length).toBeGreaterThan(0)

  // Reverse order is a cost choice, not a correctness assumption: the shadow
  // registrations are appended last, so on the healthy path the loop finds one
  // immediately and never invokes an unrelated job (the recurring-invoice
  // generator on this same expression does real database work). If the wiring is
  // broken the loop still walks every entry and still fails — it just costs more
  // on the path that was already going red.
  for (const entry of [...entries].reverse()) {
    await entry.fn()
    if (spy.mock.calls.length > 0) return true
  }
  return false
}

describe('cron adoption (A5–A7)', () => {
  const priorMode = process.env.SCOPED_PRISMA_ENFORCE

  // `initCronJobs()` is one-shot (`if (initialized) return`) — a second call in a
  // `beforeEach` registers nothing and every assertion after the first would read
  // an empty list and fail for a reason that has nothing to do with adoption.
  // Registered once here; the per-test `mockClear` keeps the call counts honest.
  beforeAll(async () => {
    // SR-1: registration must not depend on the mode. Running the whole block
    // under `off` is what makes "unconditional" an assertion instead of a claim —
    // if a future edit wraps these in `if (mode === 'shadow')`, every test here
    // goes red at once.
    process.env.SCOPED_PRISMA_ENFORCE = 'off'

    const { initCronJobs } = await import('../../lib/cron-scheduler.js')
    initCronJobs()
  })

  beforeEach(() => {
    retention.mockClear()
    canary.mockClear()
    watchdog.mockClear()
  })

  afterAll(() => {
    if (priorMode === undefined) delete process.env.SCOPED_PRISMA_ENFORCE
    else process.env.SCOPED_PRISMA_ENFORCE = priorMode
  })

  it('A5 — registers shadow retention at 03:15 IST and the callback runs the pass', async () => {
    expect(await scheduleReaches('15 3 * * *', retention)).toBe(true)
  })

  it('A6 — registers the canary every 15 minutes and the callback runs it', async () => {
    expect(await scheduleReaches('*/15 * * * *', canary)).toBe(true)
  })

  it('A7 — registers the watchdog UNCONDITIONALLY, asserted under mode off (SR-1)', async () => {
    // The watchdog detects "the harness went silent". Gating its registration on
    // the very flag whose loss is one cause of that silence would mean the alarm
    // is disarmed by the failure it exists to catch (§15.1).
    expect(await scheduleReaches('*/10 * * * *', watchdog)).toBe(true)
  })
})

describe('status route adoption (A8)', () => {
  it('returns 401 unauthenticated — a 404 would mean the router is not mounted', async () => {
    // The distinction is the whole assertion. Deleting the `router.use(...)` line
    // in `routes/admin/index.ts` leaves every unit test of the route file green
    // and turns this response into a 404.
    const { createApp } = await import('../../app.js')
    const res = await request(createApp()).get('/api/admin/scoped-shadow/status')

    expect(res.status).toBe(401)
    expect(res.status).not.toBe(404)
  })
})
