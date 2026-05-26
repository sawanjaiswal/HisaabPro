/**
 * POST /api/imports/:id/commit — commit route integration tests (API.6).
 *
 * Coverage:
 *   - 401 anon (no auth cookie / header)
 *   - 400 missing X-Idempotency-Key header (commit cannot be replayed
 *     safely without one — part of the M3 four-field bind)
 *   - 404 NOT_AVAILABLE when DATA_IMPORT feature flag is off
 *   - 200 success path → service returns CommitResult
 *   - 409 BAD_COMMIT_TOKEN bubbled from the M3 assert in commit.service
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'

// Default ON — feature gate must be open before app.js evaluates FEATURES.
vi.hoisted(() => {
  process.env.FEATURE_DATA_IMPORT = 'true'
  process.env.FEATURE_DATA_IMPORT_COHORT_PCT = '100'
})

const commit = vi.hoisted(() => ({
  commitImportJob: vi.fn(),
}))
vi.mock('../../services/import/commit.service.js', () => ({
  commitImportJob: commit.commitImportJob,
}))

import request from 'supertest'
import { createApp } from '../../app.js'
import {
  anonAgent,
  generateTestToken,
  mockOwnerPermission,
  resetMocks,
  getMockPrisma,
} from '../../__tests__/helpers.js'
import { AppError, ErrorCode } from '../../lib/errors.js'

let app: ReturnType<typeof createApp>

function validCommitToken() {
  // commitBodySchema requires 20..40 chars — UUID v4 is 36.
  return randomUUID()
}

function mockIdempotencyDefaults(): void {
  const mp = getMockPrisma()
  mp.idempotencyLog.findUnique.mockResolvedValue(null)
  mp.idempotencyLog.create.mockResolvedValue({ id: 'idem-default' })
}

beforeAll(() => {
  app = createApp()
})

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
  commit.commitImportJob.mockReset()
})

describe('POST /api/imports/:id/commit', () => {
  it('401 anon', async () => {
    const res = await anonAgent(app).post('/api/imports/job-1/commit')
    expect(res.status).toBe(401)
  })

  it('400 when X-Idempotency-Key header is missing', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports/job-1/commit')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .send({ commitToken: validCommitToken() })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(commit.commitImportJob).not.toHaveBeenCalled()
  })

  it('200 happy path returns CommitResult from service', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()
    commit.commitImportJob.mockResolvedValue({
      committedCount: 2,
      skippedCount: 0,
      errorCount: 0,
      createdPartyIds: ['p1', 'p2'],
      partial: false,
    })

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports/job-1/commit')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .set('X-Idempotency-Key', randomUUID())
      .send({ commitToken: validCommitToken() })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.committedCount).toBe(2)
    expect(commit.commitImportJob).toHaveBeenCalledTimes(1)
    const args = commit.commitImportJob.mock.calls[0]![0] as {
      jobId: string
      commitToken: string
      idempotencyKey: string
    }
    expect(args.jobId).toBe('job-1')
    expect(args.commitToken.length).toBeGreaterThanOrEqual(20)
    expect(args.idempotencyKey.length).toBeGreaterThan(0)
  })

  it('409 BAD_COMMIT_TOKEN — service raises AppError, route preserves status', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()
    commit.commitImportJob.mockRejectedValue(
      new AppError(
        ErrorCode.BAD_COMMIT_TOKEN,
        409,
        'commit token mismatch — refresh preview and retry',
      ),
    )

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports/job-1/commit')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .set('X-Idempotency-Key', randomUUID())
      .send({ commitToken: validCommitToken() })

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('BAD_COMMIT_TOKEN')
  })

  // ── API.8 — dedupResolutions in the commit body ─────────────────────
  it('200 happy path threads dedupResolutions[] to the service', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()
    commit.commitImportJob.mockResolvedValue({
      committedCount: 1,
      skippedCount: 0,
      errorCount: 0,
      createdPartyIds: [],
      overwrittenPartyIds: ['party-99'],
      partial: false,
    })

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports/job-1/commit')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .set('X-Idempotency-Key', randomUUID())
      .send({
        commitToken: validCommitToken(),
        dedupResolutions: [{ rowId: 'r1', decision: 'OVERWRITE' }],
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.overwrittenPartyIds).toEqual(['party-99'])
    const args = commit.commitImportJob.mock.calls[0]![0] as {
      dedupResolutions?: Array<{ rowId: string; decision: string }>
    }
    expect(args.dedupResolutions).toEqual([{ rowId: 'r1', decision: 'OVERWRITE' }])
  })

  it('400 when dedupResolutions[].decision is invalid', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports/job-1/commit')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .set('X-Idempotency-Key', randomUUID())
      .send({
        commitToken: validCommitToken(),
        // 'IGNORE' is not a valid decision — zod rejects at the route.
        dedupResolutions: [{ rowId: 'r1', decision: 'IGNORE' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(commit.commitImportJob).not.toHaveBeenCalled()
  })

  it('400 on .strict() — unknown body key rejected by Zod', async () => {
    mockOwnerPermission()
    mockIdempotencyDefaults()

    const token = generateTestToken()
    const res = await request(app)
      .post('/api/imports/job-1/commit')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Version', '7.1.0')
      .set('X-Idempotency-Key', randomUUID())
      .send({ commitToken: validCommitToken(), unexpected: 'no' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
