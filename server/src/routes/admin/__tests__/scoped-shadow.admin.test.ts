/**
 * Status endpoint contract (File #40, AC-12 + AC-27).
 *
 * Runs the REAL service against the mocked Prisma rather than mocking the
 * service out. A route test that stubs its own service asserts that Express can
 * route — which was never in doubt. What is in doubt is whether a tenant id can
 * reach the wire (FM-13) and whether the audit row survives an edit (M-3), and
 * neither is observable through a stubbed service.
 *
 * ── Deviation from §8.3's status table, stated ────────────────────────────────
 *
 * §8.3 lists "authenticated non-admin → 403". `requireAdmin` verifies the token
 * with `audience: 'admin'`, so a *user* token fails signature verification and
 * comes back 401 INVALID_TOKEN, not 403. That is stronger than the table (the
 * two token populations are cryptographically disjoint, not merely
 * role-checked), so the test asserts what the middleware actually does and the
 * 403 arm is covered by the reachable one: an admin whose account is inactive.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../app.js'
import { generateAdminTokens } from '../../../middleware/admin-auth.js'
import { generateTestToken, getMockPrisma, resetMocks } from '../../../__tests__/helpers.js'

const app = createApp()

const ADMIN_ID = 'admin-1'
const RAW_BUSINESS_ID = 'biz-secret-0001'
const LAST_SEEN = new Date('2026-07-22T00:30:00.000Z')

function adminToken(): string {
  return generateAdminTokens(ADMIN_ID, 'ops@hisaabpro.in', 'ADMIN').accessToken
}

/** Admin exists, is active, and the DB role matches the JWT role. */
function seedAdmin(isActive = true): void {
  getMockPrisma().adminUser.findUnique.mockResolvedValue({ role: 'ADMIN', isActive })
}

function seedShadowTables(): void {
  const mp = getMockPrisma()

  mp.scopedShadowStat.findMany.mockResolvedValue([
    { kind: 'sampled', routeHint: '', count: 10 },
    { kind: 'observed-framed', routeHint: '/api/parties', count: 5 },
  ])

  mp.scopedShadowDivergence.findMany.mockResolvedValue([
    {
      kind: 'diverged',
      model: 'Party',
      operation: 'findMany',
      subjectBusinessId: RAW_BUSINESS_ID,
      unscopedCount: 12,
      scopedCount: 9,
      onlyUnscoped: ['p1', 'p2', 'p3'],
      onlyScoped: [],
      truncated: false,
      suppressed: 4,
      routeHint: '',
      provenance: 'http',
      hadBusinessOnToken: true,
      hasInclude: false,
      hasBoundedWindow: false,
      observationIntervalMs: 12,
      errorName: null,
      lastSeenAt: LAST_SEEN,
    },
  ])

  // One lost HTTP frame, seen 2 further times — the sub-population gated at 0.
  mp.scopedShadowDivergence.groupBy.mockResolvedValue([
    { provenance: 'http', hadBusinessOnToken: true, _count: { _all: 1 }, _sum: { suppressed: 2 } },
    { provenance: 'job', hadBusinessOnToken: false, _count: { _all: 5 }, _sum: { suppressed: null } },
  ])

  // Keyed on the predicate, not on call order — the three `count` calls are
  // issued inside one Promise.all and their order is an implementation detail.
  mp.scopedShadowDivergence.count.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    if (args.where['errorName']) return 3
    if (args.where['hasInclude']) return 1
    return 4
  })

  mp.scopedShadowDivergence.findFirst.mockResolvedValue({ lastSeenAt: LAST_SEEN })
}

describe('GET /api/admin/scoped-shadow/status', () => {
  const priorMode = process.env.SCOPED_PRISMA_ENFORCE

  beforeEach(() => {
    resetMocks()
    process.env.SCOPED_PRISMA_ENFORCE = 'shadow'
  })

  afterEach(() => {
    if (priorMode === undefined) delete process.env.SCOPED_PRISMA_ENFORCE
    else process.env.SCOPED_PRISMA_ENFORCE = priorMode
  })

  it('401s an anonymous request', async () => {
    const res = await request(app).get('/api/admin/scoped-shadow/status')
    expect(res.status).toBe(401)
  })

  it('401s a valid USER token — the admin audience is cryptographically disjoint', async () => {
    const res = await request(app)
      .get('/api/admin/scoped-shadow/status')
      .set('Authorization', `Bearer ${generateTestToken()}`)
    expect(res.status).toBe(401)
    expect(getMockPrisma().scopedShadowDivergence.findMany).not.toHaveBeenCalled()
  })

  it('403s an admin whose account is inactive', async () => {
    seedAdmin(false)
    const res = await request(app)
      .get('/api/admin/scoped-shadow/status')
      .set('Authorization', `Bearer ${adminToken()}`)
    expect(res.status).toBe(403)
  })

  it('404s when the mode is not shadow, instead of an all-zero 200', async () => {
    // An empty 200 from a harness that was never installed is indistinguishable
    // from one that observed nothing — the exact failure this epic exists over.
    process.env.SCOPED_PRISMA_ENFORCE = 'off'
    seedAdmin()
    const res = await request(app)
      .get('/api/admin/scoped-shadow/status')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('SHADOW_DISABLED')
    expect(getMockPrisma().scopedShadowDivergence.findMany).not.toHaveBeenCalled()
  })

  it('200s with the status payload, hashes the tenant id, and audits exactly once', async () => {
    seedAdmin()
    seedShadowTables()

    const res = await request(app)
      .get('/api/admin/scoped-shadow/status')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    const data = res.body.data

    expect(data.mode).toBe('shadow')
    expect(data.boundClient).toBe('scoped')
    expect(data.rawSqlSitesUnaudited).toBe(true)
    expect(data.canaryLastSeenAt).toBe(LAST_SEEN.toISOString())
    expect(data.distinctFramedRoutes).toBe(2)

    expect(data.windowCounts.sampled).toBe(10)
    expect(data.windowCounts.observedFramed).toBe(5)
    // rows + Σ suppressed — an upper bound, which cannot turn non-zero into zero.
    expect(data.windowCounts.noContextHttpFrameLost).toBe(3)
    expect(data.windowCounts.noContextJob).toBe(5)
    expect(data.windowCounts.timedOut).toBe(3)
    expect(data.includeBlindFraction).toBe(0.25)

    // FM-13 / AC-27 — the raw tenant id must not appear ANYWHERE in the payload,
    // not merely in the field that was supposed to carry it.
    expect(JSON.stringify(res.body)).not.toContain(RAW_BUSINESS_ID)
    expect(data.recent[0].businessIdHash).toMatch(/^[0-9a-f]{12}$/)
    expect(data.recent[0].routeHint).toBeNull()

    // AC-27 — exactly one AdminAction row, naming the actor and the action.
    const create = getMockPrisma().adminAction.create
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data).toMatchObject({
      adminId: ADMIN_ID,
      action: 'VIEW_SCOPED_SHADOW_STATUS',
    })
  })
})
