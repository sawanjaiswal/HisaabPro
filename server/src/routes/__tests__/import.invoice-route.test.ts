/**
 * POST /api/imports — invoice-entity route tests (Phase 7 · 7.1C PR-C4).
 *
 * Covers the routing-layer slice of 7.1C:
 *   - Zod accepts `entity='invoice'` (regression for the union extend)
 *   - 426 UPGRADE_REQUIRED for `entity='invoice'` with clientVersion 7.1.1
 *     (per-entity floor — AUDIT S2)
 *   - 200 for `entity='product'` with the SAME 7.1.1 client (per-entity
 *     gate; parties/product floor stays at 7.1.0)
 *   - GET /api/imports/:id — foreign jobId returns 404 (S6 — no
 *     existence disclosure)
 *
 * Service-level invariants (parsers, normalizer, commit) are covered by
 * the unit suites + integration.invoices.endtoend.test.ts.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.hoisted(() => {
  process.env.FEATURE_DATA_IMPORT = 'true'
  process.env.FEATURE_DATA_IMPORT_COHORT_PCT = '100'
})

const upload = vi.hoisted(() => ({
  createImportJob: vi.fn(),
}))
const parse = vi.hoisted(() => ({
  runParseAndStage: vi.fn(),
}))
const getSvc = vi.hoisted(() => ({
  getImportJob: vi.fn(),
}))
vi.mock('../../services/import/upload.service.js', () => ({
  createImportJob: upload.createImportJob,
  sha256: (b: Buffer) => `sha-${b.length}`,
}))
vi.mock('../../services/import/parse.service.js', () => ({
  runParseAndStage: parse.runParseAndStage,
}))
vi.mock('../../services/import/get.service.js', () => ({
  getImportJob: getSvc.getImportJob,
}))

import request from 'supertest'
import { createApp } from '../../app.js'
import {
  generateTestToken,
  mockOwnerPermission,
  resetMocks,
  getMockPrisma,
} from '../../__tests__/helpers.js'

let app: ReturnType<typeof createApp>

beforeAll(() => {
  app = createApp()
})

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
  upload.createImportJob.mockReset()
  parse.runParseAndStage.mockReset()
  getSvc.getImportJob.mockReset()
})

function buildJobView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-inv-1',
    status: 'UPLOADED',
    format: 'GENERIC_CSV',
    fileName: 'invoices.csv',
    rowCount: 0,
    errorCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('POST /api/imports — entity=invoice (PR-C4)', () => {
  it('accepts entity=invoice with clientVersion 7.1.2 and dispatches', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.importJob.findFirst.mockResolvedValue(null)
    mp.auditLog.create.mockResolvedValue({ id: 'aud-1' })
    upload.createImportJob.mockResolvedValue({
      job: buildJobView(),
      existing: false,
    })
    parse.runParseAndStage.mockResolvedValue({
      rowCount: 5,
      errorCount: 0,
      commitToken: 'invoice-token-1234567890-aaaaaa',
    })

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.2')
      .field('format', 'GENERIC_CSV')
      .field('entity', 'invoice')
      .attach('file', Buffer.from('invoiceNumber\nINV-1\n'), 'i.csv')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(upload.createImportJob).toHaveBeenCalledTimes(1)
    const args = upload.createImportJob.mock.calls[0]![0] as { entity: string }
    expect(args.entity).toBe('invoice')
  })

  it('426 for entity=invoice with clientVersion 7.1.1 (AUDIT S2 — per-entity floor)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.importJob.findFirst.mockResolvedValue(null)

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.1')
      .field('format', 'GENERIC_CSV')
      .field('entity', 'invoice')
      .attach('file', Buffer.from('invoiceNumber\nINV-1\n'), 'i.csv')

    expect(res.status).toBe(426)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('UPGRADE_REQUIRED')
    // Service must NOT have been called — the per-entity gate fires
    // before the upload service is invoked.
    expect(upload.createImportJob).not.toHaveBeenCalled()
  })

  it('200 for entity=product with clientVersion 7.1.1 (per-entity scoped — parties/product unchanged)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.importJob.findFirst.mockResolvedValue(null)
    mp.auditLog.create.mockResolvedValue({ id: 'aud-1' })
    upload.createImportJob.mockResolvedValue({
      job: buildJobView({ id: 'job-prod-1' }),
      existing: false,
    })
    parse.runParseAndStage.mockResolvedValue({
      rowCount: 3,
      errorCount: 0,
      commitToken: 'product-token-1234567890-bbbbbb',
    })

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.1')
      .field('format', 'GENERIC_CSV')
      .field('entity', 'product')
      .attach('file', Buffer.from('name,sku\nWidget,SKU-1\n'), 'p.csv')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('Zod 400 for invalid entity value', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.importJob.findFirst.mockResolvedValue(null)

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.2')
      .field('format', 'GENERIC_CSV')
      .field('entity', 'spaceships')
      .attach('file', Buffer.from('x\n'), 'x.csv')

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /api/imports/:id — S6 tenant isolation', () => {
  it('foreign jobId returns 404 (not 403) — no existence disclosure', async () => {
    mockOwnerPermission()
    const { AppError, ErrorCode } = await import('../../lib/errors.js')
    // get.service.ts throws NOT_FOUND when businessId/userId scope misses.
    getSvc.getImportJob.mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND, 404, 'Import job not found'),
    )

    const token = generateTestToken()
    const res = await request(app)
      .get('/api/imports/foreign-job-id-deadbeef')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    // Important: 404 vs 403. A 403 would confirm the job exists.
    expect(res.body.error.code).not.toBe('FORBIDDEN')
  })
})
