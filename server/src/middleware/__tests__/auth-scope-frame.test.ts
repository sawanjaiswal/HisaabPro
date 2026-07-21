/**
 * File #30 — A3a, A3b, AC-25. The frame assertions.
 *
 * This file exists because of FM-17. The obvious way to open the tenant frame is
 * `app.use(scopedContext)`, which greps clean, mounts without error, and opens no
 * frame at all: app-level middleware runs before router-level `auth`, so `req.user`
 * is undefined and every request takes the no-frame branch. The symptom is 100%
 * `no-context` records — indistinguishable, from the harness's side, from an
 * application that genuinely has no tenants. A grep for the call site cannot tell
 * those apart. Real requests through the real `createApp()` can.
 *
 * The three assertions, and why each is shaped the way it is:
 *
 *   A3a — every divergence record from an authenticated request carries a non-null
 *         `subjectBusinessId`, i.e. ZERO `no-context` rows on the HTTP path. Hard,
 *         across ≥20 distinct routers, because the failure mode is per-mount.
 *   A3b — ≥15 of those routers produce a non-empty `routeHint`. Softer on purpose:
 *         a router that answers before its handler layer matches (403 at a
 *         permission gate, 400 at validation) legitimately has no `req.route`. The
 *         shortfall is enumerated by name rather than rounded away.
 *   AC-25 — with the business frame stubbed out, `no-context ∧ http ∧
 *         hadBusinessOnToken` goes NON-ZERO. Without this, A3a is a gate that has
 *         never been observed to fail, which is the exact defect class this epic
 *         was created to remove.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'
import { __basePrismaUnsafe as db } from '../../lib/prisma.js'
import { generateToken, authRequest } from '../../__tests__/integration/auth-helper.js'
import { seedFullSetup } from '../../__tests__/integration/factories.js'

/**
 * AC-25's stub. Flipped for one block, so the falsification runs against the same
 * app, the same routes, and the same harness as the assertion it falsifies —
 * `runWithRequestMeta` stays real, which is the whole point: `hadBusinessOnToken`
 * must still be recorded when the tenant frame is gone. That combination IS the
 * continuation-leak signature.
 */
let suppressBusinessFrame = false
vi.mock('../../lib/business-context.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/business-context.js')>()
  return {
    ...actual,
    runInBusinessContext: <T>(ctx: { businessId: string; userId: string }, fn: () => T): T =>
      suppressBusinessFrame ? fn() : actual.runInBusinessContext(ctx, fn),
  }
})

/** 22 distinct routers, read-only. Order is irrelevant; breadth is the point. */
const ROUTES = [
  '/api/parties',
  '/api/party-groups',
  '/api/products',
  '/api/categories',
  '/api/units',
  '/api/documents',
  '/api/payments',
  '/api/dashboard/today',
  '/api/reports/sales',
  '/api/expenses',
  '/api/cheques',
  '/api/bank-accounts',
  '/api/cash-entries',
  '/api/other-income',
  '/api/loans',
  '/api/godowns',
  '/api/batches',
  '/api/stock-alerts',
  '/api/custom-fields',
  '/api/notifications',
  '/api/sessions',
  '/api/tax-categories',
]

const app = createApp()
let token = ''

/**
 * The sink is fire-and-forget by design (§5.2), so the writes land after the
 * responses do. Wait for the tables to stop growing rather than sleeping a fixed
 * guess: a flat 800ms was enough for this file alone and NOT enough after fifteen
 * other files had warmed the same database, which showed up as A3b capturing 14
 * route hints instead of 16 — a threshold failure that reads exactly like a
 * regression in route-hint resolution and is not one.
 *
 * Quiescence, not a target count: this helper must not know what the assertions
 * expect, or it becomes a retry loop that waits for the test to pass.
 */
async function drain(maxMs = 8000): Promise<void> {
  const deadline = Date.now() + maxMs
  let previous = -1
  let stable = 0
  while (Date.now() < deadline && stable < 2) {
    await new Promise((r) => setTimeout(r, 150))
    const total =
      (await db.scopedShadowDivergence.count()) + (await db.scopedShadowStat.count())
    stable = total === previous ? stable + 1 : 0
    previous = total
  }
}

async function hitAll(): Promise<{ path: string; status: number }[]> {
  const results: { path: string; status: number }[] = []
  for (const path of ROUTES) {
    const res = await authRequest(app, token).get(path)
    results.push({ path, status: res.status })
  }
  return results
}

beforeAll(async () => {
  const { user, business } = await seedFullSetup()
  token = generateToken(user.id, user.phone, business.id)
  await db.scopedShadowDivergence.deleteMany({})
  await db.scopedShadowStat.deleteMany({})
})

afterAll(async () => {
  await db.scopedShadowDivergence.deleteMany({})
  await db.scopedShadowStat.deleteMany({})
})

describe('A3a — the tenant frame opens inside auth, for every router', () => {
  let responses: { path: string; status: number }[] = []

  beforeAll(async () => {
    responses = await hitAll()
    await drain()
  })

  it('reaches ≥20 distinct routers without a server error', () => {
    // A 4xx is fine — a permission gate or a missing query param still proves the
    // request passed through `auth`. A 5xx means the route never ran, and an
    // assertion built on routes that never ran proves nothing.
    const failed = responses.filter((r) => r.status >= 500)
    expect(failed.map((f) => `${f.path} → ${f.status}`)).toEqual([])
    expect(responses.filter((r) => r.status < 500).length).toBeGreaterThanOrEqual(20)
  })

  it('produces ZERO no-context records', async () => {
    const orphans = await db.scopedShadowDivergence.findMany({
      where: { kind: 'no-context' },
      select: { model: true, operation: true, provenance: true, routeHint: true },
    })
    // Deliberately NOT filtered on `provenance: 'http'`. Provenance comes from the
    // request-meta frame, which `enterTenantFrame` opens in the same breath as the
    // tenant frame — so filtering on it makes the assertion vacuous in exactly the
    // scenario it exists to catch: delete the call from `auth.ts` and every record
    // becomes `job`, matching nothing, and the gate reports clean. Verified by
    // reverting `auth.ts` and watching this fail.
    //
    // Cron is not initialised under NODE_ENV=test, so every query in this window
    // originates from the requests above.
    expect(orphans).toEqual([])
  })

  it('leaves every divergence record carrying a tenant', async () => {
    const rows = await db.scopedShadowDivergence.findMany({
      select: { kind: true, provenance: true, subjectBusinessId: true, routeHint: true },
    })
    expect(rows.filter((r) => r.subjectBusinessId === null)).toEqual([])
  })
})

describe('A3b — the route-hint thunk resolves to a template', () => {
  it('records a non-empty routeHint for ≥15 of the routers', async () => {
    const rows = (await db.scopedShadowStat.findMany({
      where: { kind: 'observed-framed', routeHint: { not: '' } },
      select: { routeHint: true },
      distinct: ['routeHint'],
    })) as { routeHint: string }[]

    const hints = rows.map((r) => r.routeHint).sort()
    // Enumerated, not rounded: the failure message names every hint captured, so a
    // shortfall becomes File #49's list rather than a lowered threshold.
    //
    // Currently 16 of 22. The six that produce no hint, and why, is the shortfall
    // File #49 records: /api/documents, /api/dashboard/today, /api/reports/sales,
    // /api/godowns, /api/batches, /api/sessions — each answers before its handler
    // layer matches, so `req.route` is never populated.
    expect(hints.length, `captured routeHints: ${JSON.stringify(hints)}`).toBeGreaterThanOrEqual(15)
  })

  it('records the Express TEMPLATE, never an interpolated path', async () => {
    const rows = (await db.scopedShadowStat.findMany({
      where: { kind: 'observed-framed', routeHint: { not: '' } },
      select: { routeHint: true },
    })) as { routeHint: string }[]

    for (const { routeHint } of rows) {
      // A uuid in a routeHint is a tenant's primary key in a durable,
      // admin-readable table (MS-8).
      expect(routeHint).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i)
      expect(routeHint).not.toContain('?')
    }
  })
})

describe('AC-25 — the gate can redden (AA-3)', () => {
  beforeAll(async () => {
    await db.scopedShadowDivergence.deleteMany({})
    suppressBusinessFrame = true
    await hitAll()
    await drain()
    suppressBusinessFrame = false
  })

  it('records no-context ∧ http ∧ hadBusinessOnToken when the frame is lost', async () => {
    const leaks = await db.scopedShadowDivergence.count({
      where: { kind: 'no-context', provenance: 'http', hadBusinessOnToken: true },
    })
    // The rev-1 predicate was `NOT noBusinessOnToken`, which — traced against this
    // design's own control flow — was empty by construction and read 0 even with
    // `enterTenantFrame` deleted outright. This assertion is the proof that the
    // replacement is reachable.
    expect(leaks).toBeGreaterThan(0)
  })

  it('still records the tenant signal from the token, with no tenant frame open', async () => {
    const row = await db.scopedShadowDivergence.findFirst({
      where: { kind: 'no-context', provenance: 'http' },
      select: { hadBusinessOnToken: true, subjectBusinessId: true, routeHint: true },
    })
    expect(row?.hadBusinessOnToken).toBe(true)
    // No frame means no tenant to attribute the query to — that asymmetry (the
    // token had one, the query did not) is exactly what makes the record a defect
    // report rather than a benign pre-business request.
    expect(row?.subjectBusinessId).toBeNull()
  })
})
