/**
 * payroll.routes integration tests — Phase 6 PR6 (architecture §6.1 + §18.7).
 *
 * Routes exercised:
 *   POST /api/payroll/run/preview
 *   POST /api/payroll/run/finalize
 *   POST /api/payroll/run/:id/reverse
 *   GET  /api/payroll/:id/snapshot
 *
 * Test infrastructure mirrors audit.routes.test.ts — auto-mocked prisma via
 * setup.ts, PIN cookie minted via buildGraceCookie() so requireRecentPin
 * passes, valid UUID v4 idempotency key minted for write routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../app.js'
import {
  anonAgent,
  generateTestToken,
  mockOwnerPermission,
  resetMocks,
  getMockPrisma,
  TEST_USER,
} from '../../__tests__/helpers.js'
import { hashPin } from '../../services/security-pin/pin-hash.util.js'
import {
  buildGraceCookie,
  COOKIE_NAME,
  type RouteClass,
} from '../../services/security-pin/pin-grace-cookie.js'

const app = createApp()

function seedPinGrace(routeClass: RouteClass = 'mutation'): { cookieHeader: string } {
  const mp = getMockPrisma()
  const pinHash = hashPin('1234')
  mp.userAppSettings.findUnique.mockResolvedValue({ pinHash })
  const value = buildGraceCookie(TEST_USER.userId, TEST_USER.businessId, routeClass, pinHash)
  return { cookieHeader: `${COOKIE_NAME}=${value}` }
}

function authPost(url: string, opts: { pin?: boolean; idemp?: boolean } = {}) {
  const token = generateTestToken()
  let req = request(app).post(url).set('Authorization', `Bearer ${token}`)
  if (opts.pin !== false) {
    const { cookieHeader } = seedPinGrace('mutation')
    req = req.set('Cookie', cookieHeader)
  }
  if (opts.idemp !== false) {
    req = req.set('X-Idempotency-Key', randomUUID())
  }
  return req
}

function authGet(url: string) {
  const token = generateTestToken()
  return request(app).get(url).set('Authorization', `Bearer ${token}`)
}

/**
 * idempotencyCheck() middleware does `prisma.idempotencyLog.findUnique` + a
 * post-response `prisma.idempotencyLog.create(...).catch(...)`. The auto-mock
 * Proxy returns undefined from un-configured methods, which makes the
 * `.catch()` chain explode. Install null findUnique + resolved create here
 * so PIN-gated write routes can reach the handler cleanly.
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

// ─── POST /api/payroll/run/preview ──────────────────────────────────────────

describe('POST /api/payroll/run/preview', () => {
  it('200 with lines when owner posts valid range', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'Anil', dailyRate: 50_000, partyId: 'party-1' },
    ])
    mp.attendance.findMany.mockResolvedValue([
      { employeeId: 'emp-1', status: 'PRESENT', overtimeMin: 0 },
      { employeeId: 'emp-1', status: 'PRESENT', overtimeMin: 0 },
    ])
    mp.employeeAdvance.findMany.mockResolvedValue([])

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/payroll/run/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromDate: '2026-05-01', toDate: '2026-05-31' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.lines).toHaveLength(1)
    expect(res.body.data.lines[0].netPaise).toBe(100_000)
    expect(res.body.data.totals.netPaise).toBe(100_000)
  })

  it('401 anon → preview rejected (no auth header)', async () => {
    const res = await anonAgent(app).post('/api/payroll/run/preview')
    expect(res.status).toBe(401)
  })

  it('400 on inverted date range (Zod .refine)', async () => {
    mockOwnerPermission()
    const token = generateTestToken()
    const res = await request(app)
      .post('/api/payroll/run/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromDate: '2026-05-31', toDate: '2026-05-01' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('400 on bad date format (Zod regex)', async () => {
    mockOwnerPermission()
    const token = generateTestToken()
    const res = await request(app)
      .post('/api/payroll/run/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromDate: '01/05/2026', toDate: '31/05/2026' })

    expect(res.status).toBe(400)
  })

  it('400 on unknown body key (Zod .strict)', async () => {
    mockOwnerPermission()
    const token = generateTestToken()
    const res = await request(app)
      .post('/api/payroll/run/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromDate: '2026-05-01', toDate: '2026-05-31', injectedKey: 'evil' })

    expect(res.status).toBe(400)
  })
})

// ─── POST /api/payroll/run/finalize ────────────────────────────────────────

describe('POST /api/payroll/run/finalize', () => {
  function seedFinalizeMocks() {
    mockIdempotencyDefaults()
    const mp = getMockPrisma()
    mp.business.findFirst.mockResolvedValue({
      id: TEST_USER.businessId,
      name: 'Anil Traders',
      phone: '+919876543210',
    })
    mp.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'Anil', dailyRate: 50_000, partyId: 'party-1' },
    ])
    mp.attendance.findMany.mockResolvedValue([
      { employeeId: 'emp-1', status: 'PRESENT', overtimeMin: 0 },
      { employeeId: 'emp-1', status: 'PRESENT', overtimeMin: 0 },
    ])
    mp.employeeAdvance.findMany.mockResolvedValue([])
    mp.payrollRun.create.mockResolvedValue({ id: 'run-1' })
    mp.employee.findMany.mockResolvedValueOnce([
      {
        id: 'emp-1',
        name: 'Anil',
        phone: null,
        designation: null,
        partyId: 'party-1',
        dailyRate: 50_000,
      },
    ])
    mp.payment.create.mockResolvedValue({ id: 'pay-1' })
    mp.payroll.create.mockResolvedValue({ id: 'payroll-1' })
    mp.payslipSnapshot.create.mockResolvedValue({ id: 'snap-1' })
    mp.auditLog.create.mockResolvedValue({ id: 'audit-1' })
  }

  it('200 with payrollRunId when owner finalizes valid period', async () => {
    mockOwnerPermission()
    seedFinalizeMocks()

    const res = await authPost('/api/payroll/run/finalize').send({
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('FINALIZED')
    expect(res.body.data.payrollRunId).toBe('run-1')
    expect(res.body.data.count).toBe(1)
  })

  it('403 PIN_REQUIRED when pin_gate_grace cookie absent', async () => {
    mockOwnerPermission()
    seedFinalizeMocks()

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/payroll/run/finalize')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Idempotency-Key', randomUUID())
      .send({ fromDate: '2026-05-01', toDate: '2026-05-31' })

    expect(res.status).toBe(403)
    expect(res.body.error?.code).toBe('PIN_REQUIRED')
  })

  it('400 when X-Idempotency-Key header missing', async () => {
    mockOwnerPermission()
    seedFinalizeMocks()

    const token = generateTestToken()
    const { cookieHeader } = seedPinGrace('mutation')
    const res = await request(app)
      .post('/api/payroll/run/finalize')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookieHeader)
      .send({ fromDate: '2026-05-01', toDate: '2026-05-31' })

    expect(res.status).toBe(400)
  })
})

// ─── POST /api/payroll/run/:id/reverse ─────────────────────────────────────

describe('POST /api/payroll/run/:id/reverse', () => {
  it('200 + REVERSED when owner reverses a FINALIZED run', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()
    const mp = getMockPrisma()

    mp.payrollRun.findFirst.mockResolvedValueOnce({
      id: 'ckxxxx0000000000000000001',
      status: 'FINALIZED',
    })
    mp.payrollRun.findFirst.mockResolvedValueOnce({
      id: 'ckxxxx0000000000000000001',
      status: 'FINALIZED',
      payrolls: [
        {
          id: 'payroll-1',
          status: 'FINALIZED',
          payment: { id: 'pay-1', partyId: 'party-1', amount: 100_000, mode: 'CASH' },
        },
      ],
    })
    mp.payment.create.mockResolvedValue({ id: 'pay-rev-1' })
    mp.payroll.update.mockResolvedValue({ id: 'payroll-1' })
    mp.payrollRun.update.mockResolvedValue({ id: 'ckxxxx0000000000000000001' })
    mp.auditLog.create.mockResolvedValue({ id: 'a' })

    const res = await authPost(
      '/api/payroll/run/ckxxxx0000000000000000001/reverse',
    ).send({})

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('REVERSED')
    expect(res.body.data.reversedCount).toBe(1)
  })

  it('409 PAYROLL_ALREADY_REVERSED on second reverse of same run', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()
    const mp = getMockPrisma()
    mp.payrollRun.findFirst.mockResolvedValue({
      id: 'ckxxxx0000000000000000001',
      status: 'REVERSED',
    })

    const res = await authPost(
      '/api/payroll/run/ckxxxx0000000000000000001/reverse',
    ).send({})

    expect(res.status).toBe(409)
    expect(res.body.error?.code).toBe('PAYROLL_ALREADY_REVERSED')
  })
})

// ─── GET /api/payroll/:id/snapshot ──────────────────────────────────────────

describe('GET /api/payroll/:id/snapshot', () => {
  it('200 with snapshot when owner fetches own payroll', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.payroll.findFirst.mockResolvedValue({
      id: 'ckxxxx0000000000000000001',
      payrollRunId: 'run-1',
      employeeId: 'emp-1',
      netPaise: 100_000,
      status: 'FINALIZED',
      snapshot: {
        payload: {
          schemaVersion: 1,
          business: { id: TEST_USER.businessId, name: 'X' },
          employee: { id: 'emp-1', name: 'Anil', dailyRatePaise: 50_000 },
          period: { fromDate: '2026-05-01', toDate: '2026-05-31' },
          lines: {
            presentDays: 2,
            halfDays: 0,
            overtimeMin: 0,
            basePaise: 100_000,
            halfPayPaise: 0,
            overtimePayPaise: 0,
            grossPaise: 100_000,
            advanceTotalPaise: 0,
            deductionsPaise: 0,
            netPaise: 100_000,
          },
          payment: { id: 'pay-1', mode: 'CASH', date: new Date().toISOString() },
          finalizedAt: new Date().toISOString(),
          finalizedBy: { userId: 'u1', name: null },
        },
      },
    })

    const res = await authGet('/api/payroll/ckxxxx0000000000000000001/snapshot')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.payroll.id).toBe('ckxxxx0000000000000000001')
    expect(res.body.data.snapshot.lines.netPaise).toBe(100_000)
  })

  it('404 cross-tenant — Payroll.findFirst returns null', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.payroll.findFirst.mockResolvedValue(null)

    const res = await authGet('/api/payroll/ckxxxx0000000000000000002/snapshot')

    expect(res.status).toBe(404)
    expect(res.body.error?.message).toBe('PAYROLL_NOT_FOUND')
  })

  it('400 on non-cuid id (Zod param)', async () => {
    mockOwnerPermission()
    const res = await authGet('/api/payroll/not-a-cuid/snapshot')

    expect(res.status).toBe(400)
  })
})
