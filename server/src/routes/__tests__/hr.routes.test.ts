/**
 * hr.routes integration tests — Phase 6 PR5 (architecture §6.1 row 708).
 *
 * Covers:
 *   POST /api/hr/attendance/batch — 200 happy / 401 anon / 403 staff /
 *                                    403 PIN_REQUIRED / 400 INVALID_EMPLOYEE_ID
 *                                    / idempotency replay
 *   GET  /api/hr/attendance       — 200 happy / 400 range > 92 days /
 *                                    [] cross-tenant employeeId
 *
 * Test infrastructure mirrors businesses-suspend.test.ts + audit.routes.test.ts:
 *   - auto-mocked prisma via setup.ts
 *   - PIN cookie minted via buildGraceCookie() so requireRecentPin('mutation')
 *     passes for TEST_USER
 *   - mockOwnerPermission()/mockStaffPermission() install the auth + active-
 *     business + owner mock chain
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import {
  authAgent,
  anonAgent,
  generateTestToken,
  mockOwnerPermission,
  mockStaffPermission,
  resetMocks,
  getMockPrisma,
  TEST_USER,
} from '../../__tests__/helpers.js'
import { hashPin } from '../../services/security-pin/pin-hash.util.js'
import { buildGraceCookie, COOKIE_NAME, type RouteClass } from '../../services/security-pin/pin-grace-cookie.js'

const app = createApp()
const BATCH_PATH = '/api/hr/attendance/batch'
const LIST_PATH = '/api/hr/attendance'

// A valid UUID v4 for idempotency keys (matches requireIdempotencyKey regex).
const IDEM_KEY = 'a3f1b2c4-5d6e-4f7a-8b9c-0d1e2f3a4b5c'
const IDEM_KEY_2 = 'b4f2c3d5-6e7f-4a8b-9c0d-1e2f3a4b5c6d'

/**
 * Mint a valid pin_gate_grace cookie + stub UserAppSettings.pinHash so
 * requireRecentPin(routeClass) passes for TEST_USER on the active business.
 * Call AFTER mockOwnerPermission() / mockStaffPermission().
 */
function seedPinGrace(routeClass: RouteClass = 'mutation'): { cookieHeader: string } {
  const mp = getMockPrisma()
  const pinHash = hashPin('1234')
  mp.userAppSettings.findUnique.mockResolvedValue({ pinHash })
  const value = buildGraceCookie(TEST_USER.userId, TEST_USER.businessId, routeClass, pinHash)
  return { cookieHeader: `${COOKIE_NAME}=${value}` }
}

function pinAuthAgent(
  method: 'get' | 'post',
  url: string,
  routeClass: RouteClass = 'mutation',
) {
  const token = generateTestToken()
  const { cookieHeader } = seedPinGrace(routeClass)
  return request(app)[method](url)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', cookieHeader)
}

/**
 * idempotencyCheck() middleware does `prisma.idempotencyLog.findUnique` + a
 * post-response `prisma.idempotencyLog.create(...).catch(...)`. The auto-mock
 * Proxy returns `undefined` from un-configured methods which makes the
 * `.catch()` chain explode — install null findUnique + resolved create here
 * so the batch happy paths reach the route handler cleanly. Tests that
 * exercise the cache-hit branch override findUnique themselves.
 */
function mockIdempotencyDefaults(): void {
  const mp = getMockPrisma()
  mp.idempotencyLog.findUnique.mockResolvedValue(null)
  mp.idempotencyLog.create.mockResolvedValue({ id: 'idem-default' })
}

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
})

// ─── POST /api/hr/attendance/batch ──────────────────────────────────────────

describe('POST /api/hr/attendance/batch', () => {
  it('returns 200 with summary when owner upserts a valid batch', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()
    const mp = getMockPrisma()
    mp.employee.findMany.mockResolvedValue([{ id: 'cemployee0000001' }, { id: 'cemployee0000002' }])
    mp.attendance.upsert.mockResolvedValue({ id: 'att-x' })
    mp.auditLog.create.mockResolvedValue({ id: 'audit-1' })

    const res = await pinAuthAgent('post', BATCH_PATH)
      .set('X-Idempotency-Key', IDEM_KEY)
      .send({
        entries: [
          { employeeId: 'cemployee0000001', date: '2026-05-01', status: 'PRESENT' },
          { employeeId: 'cemployee0000002', date: '2026-05-01', status: 'ABSENT' },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.written).toBe(2)
    expect(res.body.data.byStatus).toEqual({ PRESENT: 1, ABSENT: 1 })

    // Tenant-scoped employee SELECT
    expect(mp.employee.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['cemployee0000001', 'cemployee0000002'] }, businessId: TEST_USER.businessId },
      select: { id: true },
    })

    // ONE audit row with the batch summary
    expect(mp.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: TEST_USER.businessId,
        entityType: 'Attendance',
        action: 'UPSERT_BATCH',
        userId: TEST_USER.userId,
      }),
    })
  })

  it('returns 401 without an auth token', async () => {
    const res = await anonAgent(app).post(BATCH_PATH)
      .set('X-Idempotency-Key', IDEM_KEY)
      .send({ entries: [{ employeeId: 'cemployee0000001', date: '2026-05-01', status: 'PRESENT' }] })

    expect(res.status).toBe(401)
  })

  it('returns 403 OWNER_REQUIRED when caller is a staff member', async () => {
    mockStaffPermission()
    // PIN cookie minted so requireRecentPin passes; requireOwner must still 403.
    const res = await pinAuthAgent('post', BATCH_PATH)
      .set('X-Idempotency-Key', IDEM_KEY)
      .send({ entries: [{ employeeId: 'cemployee0000001', date: '2026-05-01', status: 'PRESENT' }] })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWNER_REQUIRED')
  })

  it('returns 403 PIN_REQUIRED when the pin_gate_grace cookie is missing', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.userAppSettings.findUnique.mockResolvedValue({ pinHash: hashPin('1234') })

    const token = generateTestToken()
    const res = await request(app).post(BATCH_PATH)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Idempotency-Key', IDEM_KEY)
      .send({ entries: [{ employeeId: 'cemployee0000001', date: '2026-05-01', status: 'PRESENT' }] })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PIN_REQUIRED')
  })

  it('returns 400 INVALID_EMPLOYEE_ID when an entry references an employee from another tenant', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()
    const mp = getMockPrisma()
    // DB returns only the one employee that belongs to TEST_USER.businessId.
    mp.employee.findMany.mockResolvedValue([{ id: 'cemployeemine001' }])

    const res = await pinAuthAgent('post', BATCH_PATH)
      .set('X-Idempotency-Key', IDEM_KEY)
      .send({
        entries: [
          { employeeId: 'cemployeemine001', date: '2026-05-01', status: 'PRESENT' },
          { employeeId: 'cl9ofakeother999999999999', date: '2026-05-01', status: 'PRESENT' },
        ],
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.message).toContain('INVALID_EMPLOYEE_ID')
    // No upserts, no audit row.
    expect(mp.attendance.upsert).not.toHaveBeenCalled()
    expect(mp.auditLog.create).not.toHaveBeenCalled()
  })

  it('returns 400 on missing X-Idempotency-Key header', async () => {
    mockOwnerPermission()

    const res = await pinAuthAgent('post', BATCH_PATH)
      .send({ entries: [{ employeeId: 'cemployee0000001', date: '2026-05-01', status: 'PRESENT' }] })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY')
  })

  it('returns 400 on empty entries array (Zod min(1))', async () => {
    mockOwnerPermission()

    const res = await pinAuthAgent('post', BATCH_PATH)
      .set('X-Idempotency-Key', IDEM_KEY)
      .send({ entries: [] })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 on unknown body key (strict mode)', async () => {
    mockOwnerPermission()

    const res = await pinAuthAgent('post', BATCH_PATH)
      .set('X-Idempotency-Key', IDEM_KEY)
      .send({
        entries: [{ employeeId: 'cemployee0000001', date: '2026-05-01', status: 'PRESENT' }],
        extraField: 'evil',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('replays the same response on idempotency-key replay without re-writing', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.employee.findMany.mockResolvedValue([{ id: 'cemployee0000001' }])
    mp.attendance.upsert.mockResolvedValue({ id: 'att-x' })
    mp.auditLog.create.mockResolvedValue({ id: 'audit-1' })

    // 1st call — empty cache, writes the row.
    mp.idempotencyLog.findUnique.mockResolvedValueOnce(null)
    mp.idempotencyLog.create.mockResolvedValueOnce({ id: 'idem-1' })

    const first = await pinAuthAgent('post', BATCH_PATH)
      .set('X-Idempotency-Key', IDEM_KEY_2)
      .send({ entries: [{ employeeId: 'cemployee0000001', date: '2026-05-01', status: 'PRESENT' }] })

    expect(first.status).toBe(200)
    expect(first.body.data.written).toBe(1)

    // 2nd call — the idempotency middleware finds the cached response and
    // short-circuits with the stored body.
    mp.idempotencyLog.findUnique.mockResolvedValueOnce({
      key: IDEM_KEY_2,
      userId: TEST_USER.userId,
      response: { success: true, data: { written: 1, byStatus: { PRESENT: 1 } } },
      expiresAt: new Date(Date.now() + 60_000),
    })
    // Reset upsert/audit so we can assert they were NOT called this time.
    mp.attendance.upsert.mockClear()
    mp.auditLog.create.mockClear()

    const second = await pinAuthAgent('post', BATCH_PATH)
      .set('X-Idempotency-Key', IDEM_KEY_2)
      .send({ entries: [{ employeeId: 'cemployee0000001', date: '2026-05-01', status: 'PRESENT' }] })

    expect(second.status).toBe(200)
    expect(second.body.data.written).toBe(1)
    // No new DB writes on replay.
    expect(mp.attendance.upsert).not.toHaveBeenCalled()
    expect(mp.auditLog.create).not.toHaveBeenCalled()
  })
})

// ─── GET /api/hr/attendance ─────────────────────────────────────────────────

describe('GET /api/hr/attendance', () => {
  it('returns 200 with rows in the date range', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    const rows = [
      { id: 'a1', businessId: TEST_USER.businessId, employeeId: 'cemployee0000001', date: new Date('2026-05-01'), status: 'PRESENT', overtimeMin: 0, note: null, createdAt: new Date() },
    ]
    mp.attendance.findMany.mockResolvedValue(rows)

    const res = await authAgent(app).get(`${LIST_PATH}?from=2026-05-01&to=2026-05-31`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.rows).toHaveLength(1)
    expect(res.body.data.rows[0].employeeId).toBe('cemployee0000001')

    // The query was tenant-scoped to req.activeBusiness.id (= TEST_USER.businessId).
    const call = mp.attendance.findMany.mock.calls[0]![0] as { where: { businessId: string } }
    expect(call.where.businessId).toBe(TEST_USER.businessId)
  })

  it('filters by employeeIds query param (CSV)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.attendance.findMany.mockResolvedValue([])

    await authAgent(app).get(`${LIST_PATH}?from=2026-05-01&to=2026-05-31&employeeIds=cemployee0000001,cemployee0000002`)

    const call = mp.attendance.findMany.mock.calls[0]![0] as {
      where: { employeeId?: { in: string[] } }
    }
    expect(call.where.employeeId).toEqual({ in: ['cemployee0000001', 'cemployee0000002'] })
  })

  it('returns 401 without an auth token', async () => {
    const res = await anonAgent(app).get(`${LIST_PATH}?from=2026-05-01&to=2026-05-31`)
    expect(res.status).toBe(401)
  })

  it('returns 403 OWNER_REQUIRED when caller is a staff member', async () => {
    mockStaffPermission()
    const res = await authAgent(app).get(`${LIST_PATH}?from=2026-05-01&to=2026-05-31`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWNER_REQUIRED')
  })

  it('returns 400 when the date range exceeds 92 days', async () => {
    mockOwnerPermission()
    const res = await authAgent(app).get(`${LIST_PATH}?from=2026-01-01&to=2026-12-31`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when from/to are missing', async () => {
    mockOwnerPermission()
    const res = await authAgent(app).get(LIST_PATH)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when date format is not yyyy-mm-dd', async () => {
    mockOwnerPermission()
    const res = await authAgent(app).get(`${LIST_PATH}?from=05/01/2026&to=05/31/2026`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 on unknown query key (strict mode)', async () => {
    mockOwnerPermission()
    const res = await authAgent(app).get(`${LIST_PATH}?from=2026-05-01&to=2026-05-31&extra=1`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('cross-tenant employeeIds return [] (never 404, never 500) — Postgres applies the businessId predicate', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    // No rows match because the businessId predicate filters out the other-tenant id.
    mp.attendance.findMany.mockResolvedValue([])

    const res = await authAgent(app).get(
      `${LIST_PATH}?from=2026-05-01&to=2026-05-31&employeeIds=emp-other-tenant`,
    )

    expect(res.status).toBe(200)
    expect(res.body.data.rows).toEqual([])
    const call = mp.attendance.findMany.mock.calls[0]![0] as { where: { businessId: string } }
    expect(call.where.businessId).toBe(TEST_USER.businessId)
  })
})
