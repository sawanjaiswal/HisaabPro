/**
 * audit.routes integration tests — Phase 6 PR4 (architecture §6.1 + §18.5).
 *
 * Covers the route surface end-to-end through supertest:
 *
 *   GET    /api/audit                — 200 happy / 401 anon / 403 missing PIN
 *                                       / 400 bad cursor
 *   GET    /api/audit/redactions     — 200 list
 *   POST   /api/audit/redactions     — 200 upsert
 *   DELETE /api/audit/redactions/:id — 200 disable / 404 cross-tenant
 *   POST   /api/audit/export         — 200 + text/csv + Content-Disposition
 *
 * Test infrastructure mirrors businesses-suspend.test.ts — auto-mocked prisma
 * via setup.ts, PIN cookie minted via buildGraceCookie() so requireRecentPin
 * passes for TEST_USER.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import {
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

/**
 * Typed accessor for the top-level $queryRaw mock — the shared
 * getMockPrisma() cast (Record<string, Record<string, vi.Mock>>) treats every
 * top-level key as a nested model object, which makes TS see `mp.$queryRaw`
 * as a constructable mock union rather than a plain callable. The cast below
 * narrows it back to a vitest Mock with array args / any return so call sites
 * like `mockPrisma$queryRaw().mockResolvedValue([...])` type-check cleanly.
 */
function mockPrisma$queryRaw(): ReturnType<typeof vi.fn> {
  return getMockPrisma().$queryRaw as unknown as ReturnType<typeof vi.fn>
}

/**
 * Mint a valid pin_gate_grace cookie + stub UserAppSettings.pinHash so
 * requireRecentPin(routeClass) passes for TEST_USER on the active business.
 * Call AFTER mockOwnerPermission() / mockStaffPermission().
 */
function seedPinGrace(routeClass: RouteClass = 'read-only'): { cookieHeader: string } {
  const mp = getMockPrisma()
  const pinHash = hashPin('1234')
  mp.userAppSettings.findUnique.mockResolvedValue({ pinHash })
  const value = buildGraceCookie(TEST_USER.userId, TEST_USER.businessId, routeClass, pinHash)
  return { cookieHeader: `${COOKIE_NAME}=${value}` }
}

function pinAuthAgent(method: 'get' | 'post' | 'delete', url: string, routeClass: RouteClass = 'read-only') {
  const token = generateTestToken()
  const { cookieHeader } = seedPinGrace(routeClass)
  return request(app)[method](url)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', cookieHeader)
}

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
})

// ─── GET /api/audit ──────────────────────────────────────────────────────────

describe('GET /api/audit', () => {
  it('returns 200 with rows when owner queries with no filters', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    const now = new Date('2026-05-18T10:00:00Z')
    mockPrisma$queryRaw().mockResolvedValue([
      {
        id: 'a1', businessId: TEST_USER.businessId, action: 'CREATE',
        entityType: 'Party', entityId: 'p1', entityLabel: 'Raju',
        userId: 'u1', systemActor: null, changes: { name: 'Raju' },
        reason: null, ipAddress: '1.2.3.4', deviceInfo: null, createdAt: now,
        userName: 'Owner', userEmail: 'owner@example.com',
      },
    ])
    mp.auditLogRedaction.findMany.mockResolvedValue([])

    const res = await pinAuthAgent('get', '/api/audit')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.rows).toHaveLength(1)
    expect(res.body.data.rows[0].entityType).toBe('Party')
    expect(res.body.data.nextCursor).toBeNull()
  })

  it('applies redaction rules to the returned rows', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mockPrisma$queryRaw().mockResolvedValue([
      {
        id: 'a1', businessId: TEST_USER.businessId, action: 'UPDATE',
        entityType: 'Party', entityId: 'p1', entityLabel: 'Raju',
        userId: 'u1', systemActor: null,
        changes: { name: 'Raju', phone: '9876543210' },
        reason: null, ipAddress: null, deviceInfo: null,
        createdAt: new Date(), userName: null, userEmail: null,
      },
    ])
    mp.auditLogRedaction.findMany.mockResolvedValue([
      { id: 'r1', businessId: TEST_USER.businessId, entityType: 'Party',
        fieldPath: 'phone', enabled: true, createdAt: new Date(), createdById: 'u1' },
    ])

    const res = await pinAuthAgent('get', '/api/audit')

    expect(res.status).toBe(200)
    expect(res.body.data.rows[0].changes.phone).toBe('<redacted>')
    expect(res.body.data.rows[0].changes.name).toBe('Raju')
  })

  it('returns 401 without an auth token', async () => {
    const res = await anonAgent(app).get('/api/audit')
    expect(res.status).toBe(401)
  })

  it('returns 403 PIN_REQUIRED when the pin_gate_grace cookie is missing', async () => {
    mockOwnerPermission()
    // Authenticated, active business, but NO cookie — requireRecentPin must reject.
    const mp = getMockPrisma()
    mp.userAppSettings.findUnique.mockResolvedValue({ pinHash: hashPin('1234') })

    const token = generateTestToken()
    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PIN_REQUIRED')
  })

  it('returns 403 PIN_REQUIRED when the user has never set a PIN (settings.pinHash=null)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.userAppSettings.findUnique.mockResolvedValue({ pinHash: null })

    const token = generateTestToken()
    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PIN_REQUIRED')
    expect(res.body.error.reason).toBe('MISSING')
  })

  it('returns 400 VALIDATION_ERROR on a malformed cursor', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.auditLogRedaction.findMany.mockResolvedValue([])

    const res = await pinAuthAgent('get', '/api/audit?cursor=)*not-base64')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR on unknown query keys (strict schema)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.auditLogRedaction.findMany.mockResolvedValue([])

    const res = await pinAuthAgent('get', '/api/audit?bogusKey=1')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when a non-owner staff member tries to read the audit log', async () => {
    mockStaffPermission()
    // PIN cookie minted so requireRecentPin passes; requireOwner must still 403.
    const res = await pinAuthAgent('get', '/api/audit')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWNER_REQUIRED')
  })

  it('scopes searchAuditLogs to req.activeBusiness.id (no cross-tenant leak)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mockPrisma$queryRaw().mockResolvedValue([])
    mp.auditLogRedaction.findMany.mockResolvedValue([])

    await pinAuthAgent('get', '/api/audit')

    // The first $queryRaw call's interpolated args must include the JWT's
    // businessId (TEST_USER.businessId) — never an attacker-controlled id.
    const queryCall = mockPrisma$queryRaw().mock.calls[0]
    const flat = JSON.stringify(queryCall)
    expect(flat).toContain(TEST_USER.businessId)
  })
})

// ─── GET /api/audit/redactions ───────────────────────────────────────────────

describe('GET /api/audit/redactions', () => {
  it('returns 200 with the list of rules scoped to the active business', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    const rule = {
      id: 'r1', businessId: TEST_USER.businessId, entityType: 'Party',
      fieldPath: 'phone', enabled: true, createdAt: new Date(), createdById: 'u1',
    }
    mp.auditLogRedaction.findMany.mockResolvedValue([rule])

    const res = await pinAuthAgent('get', '/api/audit/redactions')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].fieldPath).toBe('phone')
    expect(mp.auditLogRedaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: TEST_USER.businessId },
    }))
  })

  it('returns 403 PIN_REQUIRED without a cookie', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.userAppSettings.findUnique.mockResolvedValue({ pinHash: hashPin('1234') })
    const token = generateTestToken()
    const res = await request(app).get('/api/audit/redactions').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

// ─── POST /api/audit/redactions ──────────────────────────────────────────────

describe('POST /api/audit/redactions', () => {
  it('returns 200 + upserts the rule', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    const out = {
      id: 'r-new', businessId: TEST_USER.businessId, entityType: 'Party',
      fieldPath: 'address.city', enabled: true, createdAt: new Date(),
      createdById: TEST_USER.userId,
    }
    mp.auditLogRedaction.upsert.mockResolvedValue(out)

    const res = await pinAuthAgent('post', '/api/audit/redactions', 'mutation')
      .send({ entityType: 'Party', fieldPath: 'address.city', enabled: true })

    expect(res.status).toBe(200)
    expect(res.body.data.redaction.fieldPath).toBe('address.city')
    expect(mp.auditLogRedaction.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        businessId_entityType_fieldPath: {
          businessId: TEST_USER.businessId,
          entityType: 'Party',
          fieldPath: 'address.city',
        },
      },
    }))
  })

  it('returns 400 on bad fieldPath (regex reject)', async () => {
    mockOwnerPermission()
    const res = await pinAuthAgent('post', '/api/audit/redactions', 'mutation')
      .send({ entityType: 'Party', fieldPath: 'has space' })
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing entityType', async () => {
    mockOwnerPermission()
    const res = await pinAuthAgent('post', '/api/audit/redactions', 'mutation')
      .send({ fieldPath: 'phone' })
    expect(res.status).toBe(400)
  })

  it('returns 400 on unknown body key (strict mode)', async () => {
    mockOwnerPermission()
    const res = await pinAuthAgent('post', '/api/audit/redactions', 'mutation')
      .send({ entityType: 'Party', fieldPath: 'phone', extraField: 'evil' })
    expect(res.status).toBe(400)
  })

  it('returns 403 PIN_REQUIRED when using a read-only cookie on a mutation route', async () => {
    mockOwnerPermission()
    // Cookie minted with read-only class; route requires mutation class.
    const res = await pinAuthAgent('post', '/api/audit/redactions', 'read-only')
      .send({ entityType: 'Party', fieldPath: 'phone' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PIN_REQUIRED')
  })
})

// ─── DELETE /api/audit/redactions/:id ────────────────────────────────────────

describe('DELETE /api/audit/redactions/:id', () => {
  it('returns 200 and flips enabled=false when the rule belongs to the business', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.auditLogRedaction.findUnique.mockResolvedValue({
      id: 'r1', businessId: TEST_USER.businessId, entityType: 'Party',
      fieldPath: 'phone', enabled: true, createdAt: new Date(), createdById: 'u1',
    })
    mp.auditLogRedaction.update.mockResolvedValue({
      id: 'r1', businessId: TEST_USER.businessId, entityType: 'Party',
      fieldPath: 'phone', enabled: false, createdAt: new Date(), createdById: 'u1',
    })

    const res = await pinAuthAgent('delete', '/api/audit/redactions/r1', 'mutation')

    expect(res.status).toBe(200)
    expect(res.body.data.redaction.enabled).toBe(false)
  })

  it('returns 404 when the rule belongs to another business (cross-tenant guard)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.auditLogRedaction.findUnique.mockResolvedValue({
      id: 'r1', businessId: 'other-biz', entityType: 'Party',
      fieldPath: 'phone', enabled: true, createdAt: new Date(), createdById: 'u1',
    })

    const res = await pinAuthAgent('delete', '/api/audit/redactions/r1', 'mutation')

    expect(res.status).toBe(404)
    expect(mp.auditLogRedaction.update).not.toHaveBeenCalled()
  })
})

// ─── POST /api/audit/export ──────────────────────────────────────────────────

describe('POST /api/audit/export', () => {
  it('returns 200 with text/csv + Content-Disposition headers', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mockPrisma$queryRaw().mockResolvedValue([
      {
        id: 'a1', businessId: TEST_USER.businessId, action: 'CREATE',
        entityType: 'Party', entityId: 'p1', entityLabel: 'Raju, Mr.',
        userId: 'u1', systemActor: null, changes: { name: 'Raju' },
        reason: null, ipAddress: '1.2.3.4', deviceInfo: null,
        createdAt: new Date('2026-05-18T10:00:00Z'),
        userName: 'Owner', userEmail: 'owner@example.com',
      },
    ])
    mp.auditLogRedaction.findMany.mockResolvedValue([])

    const res = await pinAuthAgent('post', '/api/audit/export', 'mutation').send({})

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['content-disposition']).toContain('audit-export-')

    // Header row + at least one data row
    const text = res.text
    expect(text).toContain('createdAt,actor,action,entityType')
    expect(text).toContain('CREATE')
    expect(text).toContain('Party')
    // Quote-escape of comma-containing label
    expect(text).toContain('"Raju, Mr."')
  })

  it('returns 403 PIN_REQUIRED with a read-only cookie (export requires mutation class)', async () => {
    mockOwnerPermission()
    const res = await pinAuthAgent('post', '/api/audit/export', 'read-only').send({})
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PIN_REQUIRED')
  })

  it('returns 403 to a non-owner staff member', async () => {
    mockStaffPermission()
    const res = await pinAuthAgent('post', '/api/audit/export', 'mutation').send({})
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWNER_REQUIRED')
  })
})
