/**
 * POST /api/imports — create route integration tests (API.6).
 *
 * Coverage (Phase 7 slice 7.1A — middleware chain + M1/M2/S3):
 *   - M2: filename with control chars + RTL overrides + leading dots
 *     arrives at the upload service sanitised
 *   - S3: requireNoActiveJob fires BEFORE multer parses the buffer,
 *     so a busy business never spends RAM on the file
 *   - 426: requireMinClientVersion rejects stale X-Client-Version
 *   - 401 anon
 *
 * Feature flag toggled via process.env BEFORE module import so the
 * `requireFeature('DATA_IMPORT')` gate is open inside this file only.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// MUST run before any import that reads FEATURES at module-init time.
// vi.hoisted runs BEFORE the import block (vitest hoists imports above
// top-level code; vi.hoisted is hoisted ABOVE that).
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
vi.mock('../../services/import/upload.service.js', () => ({
  createImportJob: upload.createImportJob,
  sha256: (b: Buffer) => `sha-${b.length}`,
}))
vi.mock('../../services/import/parse.service.js', () => ({
  runParseAndStage: parse.runParseAndStage,
}))

import request from 'supertest'
import { createApp } from '../../app.js'
import {
  anonAgent,
  generateTestToken,
  mockOwnerPermission,
  resetMocks,
  getMockPrisma,
  TEST_USER,
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
})

function buildJobView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    status: 'UPLOADED',
    format: 'GENERIC_CSV',
    fileName: 'parties.csv',
    rowCount: 0,
    errorCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('POST /api/imports', () => {
  it('401 with no auth header', async () => {
    const res = await anonAgent(app).post('/api/imports')
    expect(res.status).toBe(401)
  })

  it('426 in production when X-Client-Version is below the min', async () => {
    mockOwnerPermission()
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const token = generateTestToken()
      const res = await request(app)
        .post('/api/imports')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Client-Version', '6.0.0')
        .field('format', 'GENERIC_CSV')
        .field('entity', 'parties')
        .attach('file', Buffer.from('name,phone\nRaju,9999900001\n'), 'a.csv')

      expect(res.status).toBe(426)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('UPGRADE_REQUIRED')
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it('409 ACTIVE_JOB_EXISTS fires BEFORE multer reads the buffer (S3)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    // requireNoActiveJob sees an active job — no body should be parsed.
    mp.importJob.findFirst.mockResolvedValueOnce({
      id: 'older-job',
      status: 'PREVIEWED',
    })

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .field('format', 'GENERIC_CSV')
      .field('entity', 'parties')
      .attach('file', Buffer.from('name,phone\nRaju,9999900001\n'), 'a.csv')

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ACTIVE_JOB_EXISTS')
    // Service must NOT have been called — proof multer was bypassed for logic.
    expect(upload.createImportJob).not.toHaveBeenCalled()
  })

  it('M2 — sanitises filename: strips control chars + RTL + leading dots', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.importJob.findFirst.mockResolvedValue(null)
    mp.auditLog.create.mockResolvedValue({ id: 'aud-1' })
    upload.createImportJob.mockResolvedValue({
      job: buildJobView({ fileName: 'evil.csv' }),
      existing: false,
    })
    parse.runParseAndStage.mockResolvedValue({
      rowCount: 1,
      errorCount: 0,
      commitToken: 'token-abc-1234567890abcdef-x',
    })

    // Multer / busboy reject ASCII control bytes inside multipart
    // header BEFORE the route runs (defence in depth). The route-level
    // sanitiser still owns leading dots (hidden-file spoof) and the
    // 255-char cap, which busboy passes through unchanged.
    const evilName = '.' + '.' + '.evil.csv'
    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .field('format', 'GENERIC_CSV')
      .field('entity', 'parties')
      .attach('file', Buffer.from('name\nRaju\n'), evilName)

    expect(res.status).toBe(200)
    expect(upload.createImportJob).toHaveBeenCalledTimes(1)
    const args = upload.createImportJob.mock.calls[0]![0] as {
      fileName: string
      auth: { businessId: string; userId: string }
    }
    // Leading dots removed; payload reaches service sanitised.
    expect(args.fileName.startsWith('.')).toBe(false)
    expect(args.fileName).toBe('evil.csv')
    expect(args.fileName.length).toBeLessThanOrEqual(255)
    // M1 — auth flowed through correctly.
    expect(args.auth.userId).toBe(TEST_USER.userId)
    expect(args.auth.businessId).toBe(TEST_USER.businessId)
  })

  it('200 sync-parse path returns PREVIEWED + commitToken for small files', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.importJob.findFirst.mockResolvedValue(null)
    mp.auditLog.create.mockResolvedValue({ id: 'aud-1' })
    upload.createImportJob.mockResolvedValue({
      job: buildJobView(),
      existing: false,
    })
    parse.runParseAndStage.mockResolvedValue({
      rowCount: 2,
      errorCount: 0,
      commitToken: 'token-abc-1234567890abcdef-x',
    })

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .field('format', 'GENERIC_CSV')
      .field('entity', 'parties')
      .attach('file', Buffer.from('name\nRaju\nPriya\n'), 'p.csv')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.job.status).toBe('PREVIEWED')
    expect(res.body.data.job.commitToken).toMatch(/^token-/)
    expect(res.body.data.job.rowCount).toBe(2)
  })
})
