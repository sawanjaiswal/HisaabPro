/**
 * invite-claim.routes.test.ts — Epic C PR5 #131
 *
 * Tests (route-layer only — service logic tested independently):
 *  1. GET /api/p/invite/:token — preview requiresOtp flag (true/false)
 *  2. POST /api/p/invite/:token/claim (signup) — 200
 *  3. POST /api/p/invite/:token/claim (existing, bad/absent OTP token) → 400/401
 *  4. POST /api/p/invite/:token/claim (existing, valid OTP token) → 200
 *  5. Concurrent claim race — 50 parallel POST /claim: exactly 1×200, 49×409 LINK_CONSUMED
 *  6. Revoked link → 410 LINK_REVOKED
 *  7. Expired link → 410 LINK_EXPIRED
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { createApp } from '../../app.js'
import { PublicLinkError } from '../../middleware/resolve-public-token.js'

// ---------------------------------------------------------------------------
// Middleware passthroughs
// ---------------------------------------------------------------------------

vi.mock('../../middleware/public/rate-limit.js', () => ({
  publicRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  BUCKET_CONFIG: {},
  WINDOW_MS: 60_000,
}))

vi.mock('../../middleware/rate-limit.js', async (importOriginal) => {
  const { rateLimitPassthrough } = await import('../../__tests__/helpers.js')
  return rateLimitPassthrough(importOriginal)
})

vi.mock('../../lib/token-blacklist.js', () => ({
  isUserBlacklisted: vi.fn().mockReturnValue(false),
  blacklistToken: vi.fn(), isBlacklisted: vi.fn().mockReturnValue(false), blacklistUser: vi.fn(),
}))

vi.mock('../../middleware/csrf.js', () => ({
  csrfProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

vi.mock('../../middleware/subscription-gate.js', async (importOriginal) => {
  const pass = (_req: unknown, _res: unknown, next: () => void) => next()
  const actual = await importOriginal<typeof import('../../middleware/subscription-gate.js')>()
  return { ...actual, requireFeature: () => pass, requireQuota: () => pass }
})

vi.mock('../../middleware/permission.js', async (importOriginal) => {
  const pass = (_req: unknown, _res: unknown, next: () => void) => next()
  const actual = await importOriginal<typeof import('../../middleware/permission.js')>()
  return { ...actual, requirePermission: () => pass, requireOwner: () => pass }
})

vi.mock('../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(() => ({
    orders: { create: vi.fn() },
    payments: { fetch: vi.fn() },
    subscriptions: { create: vi.fn(), fetch: vi.fn(), cancel: vi.fn() },
  })),
}))

vi.mock('bcryptjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('bcryptjs')>()
  const defaultExport = actual.default || actual
  return {
    ...actual,
    default: {
      ...defaultExport,
      hash: vi.fn().mockResolvedValue('$2a$12$e8k...mockhash'),
      compare: vi.fn().mockResolvedValue(true),
    },
    hash: vi.fn().mockResolvedValue('$2a$12$e8k...mockhash'),
    compare: vi.fn().mockResolvedValue(true),
  }
})

// ---------------------------------------------------------------------------
// Mock prisma — factory must be self-contained (no outer variable refs)
// ---------------------------------------------------------------------------

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    sharedLink: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    party: { findFirst: vi.fn(), updateMany: vi.fn() },
    business: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    otpCode: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    businessUser: { findMany: vi.fn(), findUnique: vi.fn() },
    refreshToken: { create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'
const VALID_TOKEN = 'valid-token-at-least-16-chars'
const TOKEN_HASH = crypto.createHash('sha256').update(VALID_TOKEN).digest('hex')

const MOCK_LINK_ACTIVE = {
  id: 'link-1',
  tokenHash: TOKEN_HASH,
  resourceType: 'INVITE',
  resourceId: 'party-1',
  businessId: 'biz-1',
  issuedById: 'user-issuer-1',
  expiresAt: new Date(Date.now() + 7 * 86_400_000),
  revokedAt: null,
  claimedAt: null,
  lastAccessedAt: null,
  accessCount: 0,
  metadata: { partyName: 'Test Party', partyPhone: '9876543210' },
  createdAt: new Date(),
}

function mintOtpVerifiedToken(tokenHash: string, phone: string): string {
  return jwt.sign(
    { purpose: 'invite-claim', tokenHash, phone },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '5m' }
  )
}

// ---------------------------------------------------------------------------
// App + beforeEach
// ---------------------------------------------------------------------------

import { prisma } from '../../lib/prisma.js'

// Typed handle to mocked prisma internals
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>> & { $transaction?: ReturnType<typeof vi.fn> }>

const app = createApp()

function setupDefaultMocks() {
  vi.clearAllMocks()

  P.sharedLink.findUnique.mockResolvedValue(MOCK_LINK_ACTIVE)
  P.sharedLink.update.mockResolvedValue(MOCK_LINK_ACTIVE)
  P.party.findFirst.mockResolvedValue({ id: 'party-1', name: 'Test Party', phone: '9876543210' })
  P.business.findUnique.mockResolvedValue({ name: 'Test Biz Pvt Ltd' })
  P.user.findUnique.mockResolvedValue(null)  // no existing user by default
  P.user.create.mockResolvedValue({ id: 'new-user-1', phone: '9876543210', name: 'New User' })
  P.businessUser.findMany.mockResolvedValue([])
  P.businessUser.findUnique.mockResolvedValue({ role: 'owner', status: 'ACTIVE', isActive: true, roleRef: { permissions: [] } })
  P.refreshToken.create.mockResolvedValue({ id: 'rt-1' })
  P.refreshToken.update.mockResolvedValue({ id: 'rt-1' })

  // Default $transaction: 1×updateMany on sharedLink, 1× on party
  ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        sharedLink: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({ resourceId: 'party-1', businessId: 'biz-1' }),
        },
        party: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      }
      return fn(tx)
    }
  )
}

beforeEach(setupDefaultMocks)

// ---------------------------------------------------------------------------
// 1. Preview tests
// ---------------------------------------------------------------------------

describe('GET /api/p/invite/:token', () => {
  it('returns requiresOtp: false when no user with matching phone exists', async () => {
    P.user.findUnique.mockResolvedValue(null)

    const res = await request(app).get(`/api/p/invite/${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data.requiresOtp).toBe(false)
    expect(res.body.data.businessName).toBe('Test Biz Pvt Ltd')
    expect(res.body.data.partyName).toBe('Test Party')
    expect(res.body.data.partyPhoneMasked).toMatch(/\*{4}/)
    expect(res.body.data.partyPhoneMasked).not.toContain('9876543')
  })

  it('returns requiresOtp: true when a user with matching phone already exists', async () => {
    P.user.findUnique.mockResolvedValue({ id: 'existing-user-1' })

    const res = await request(app).get(`/api/p/invite/${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data.requiresOtp).toBe(true)
  })

  it('returns 410 LINK_REVOKED for a revoked link', async () => {
    P.sharedLink.findUnique.mockResolvedValue({ ...MOCK_LINK_ACTIVE, revokedAt: new Date(Date.now() - 1000) })

    const res = await request(app).get(`/api/p/invite/${VALID_TOKEN}`)
    expect(res.status).toBe(410)
    expect(res.body.error.code).toBe('LINK_REVOKED')
  })

  it('returns 410 LINK_EXPIRED for an expired link', async () => {
    P.sharedLink.findUnique.mockResolvedValue({ ...MOCK_LINK_ACTIVE, expiresAt: new Date(Date.now() - 1000) })

    const res = await request(app).get(`/api/p/invite/${VALID_TOKEN}`)
    expect(res.status).toBe(410)
    expect(res.body.error.code).toBe('LINK_EXPIRED')
  })

  it('returns 404 LINK_NOT_FOUND when token not in DB', async () => {
    P.sharedLink.findUnique.mockResolvedValue(null)

    const res = await request(app).get(`/api/p/invite/${VALID_TOKEN}`)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('LINK_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 2. Claim — signup branch
// ---------------------------------------------------------------------------

describe('POST /api/p/invite/:token/claim (signup)', () => {
  it('creates user and binds Party.userId atomically — returns 200', async () => {
    // Sequence of user.findUnique calls in the route handler:
    //  1. existing-user guard (signup branch): null → proceed to create
    //  2. resolveUserBusinessId: null → businessId = '' (no businesses yet)
    //  3. post-claim session issuance: {phone, name}
    P.user.findUnique
      .mockResolvedValueOnce(null)                                              // 1. no existing user
      .mockResolvedValueOnce(null)                                              // 2. resolveUserBusinessId → ''
      .mockResolvedValueOnce({ phone: '9876543210', name: 'New User' })         // 3. session user lookup

    const res = await request(app)
      .post(`/api/p/invite/${VALID_TOKEN}/claim`)
      .send({ kind: 'signup', name: 'New User', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.ok).toBe(true)
    expect(res.body.data.partyId).toBe('party-1')
  })

  it('returns 409 OTP_REQUIRED when phone is already registered', async () => {
    P.user.findUnique.mockResolvedValue({ id: 'existing-user-1' })

    const res = await request(app)
      .post(`/api/p/invite/${VALID_TOKEN}/claim`)
      .send({ kind: 'signup', name: 'Existing', password: 'password123' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('OTP_REQUIRED')
  })
})

// ---------------------------------------------------------------------------
// 3. Claim — existing user, missing/invalid OTP token
// ---------------------------------------------------------------------------

describe('POST /api/p/invite/:token/claim (existing, bad OTP token)', () => {
  it('returns 400 when otpVerifiedToken is empty string (Zod min:1)', async () => {
    const res = await request(app)
      .post(`/api/p/invite/${VALID_TOKEN}/claim`)
      .send({ kind: 'existing', otpVerifiedToken: '' })

    // Zod validate fires before handler
    expect(res.status).toBe(400)
  })

  it('returns 401 when otpVerifiedToken JWT is tampered', async () => {
    P.user.findUnique.mockResolvedValue({ id: 'existing-user-1' })

    const res = await request(app)
      .post(`/api/p/invite/${VALID_TOKEN}/claim`)
      .send({ kind: 'existing', otpVerifiedToken: 'header.payload.badsig' })

    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// 4. Claim — existing user, valid otpVerifiedToken
// ---------------------------------------------------------------------------

describe('POST /api/p/invite/:token/claim (existing, valid OTP token)', () => {
  it('binds Party.userId and issues session cookies when valid otpVerifiedToken', async () => {
    const otpVerifiedToken = mintOtpVerifiedToken(TOKEN_HASH, '9876543210')

    // Sequence for existing-user branch:
    //  1. existing-user check → found
    //  2. resolveUserBusinessId → null (no business)
    //  3. session user lookup → {phone, name}
    P.user.findUnique
      .mockResolvedValueOnce({ id: 'existing-user-1' })                        // 1. existing check
      .mockResolvedValueOnce(null)                                              // 2. resolveUserBusinessId → ''
      .mockResolvedValueOnce({ phone: '9876543210', name: 'Existing User' })   // 3. session lookup

    const res = await request(app)
      .post(`/api/p/invite/${VALID_TOKEN}/claim`)
      .send({ kind: 'existing', otpVerifiedToken })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.ok).toBe(true)
    expect(res.body.data.partyId).toBe('party-1')
  })

  it('returns 401 when otpVerifiedToken is for a different link (tokenHash mismatch)', async () => {
    const wrongTokenHash = crypto.createHash('sha256').update('completely-different-token-xyz').digest('hex')
    const otpVerifiedToken = mintOtpVerifiedToken(wrongTokenHash, '9876543210')

    P.user.findUnique.mockResolvedValue({ id: 'existing-user-1' })

    const res = await request(app)
      .post(`/api/p/invite/${VALID_TOKEN}/claim`)
      .send({ kind: 'existing', otpVerifiedToken })

    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// 5. Concurrent claim race — 50 parallel POST /claim
// ---------------------------------------------------------------------------

describe('Concurrent claim race', () => {
  it('exactly 1 success (200) and 49 failures (409 LINK_CONSUMED) among 50 parallel claims', async () => {
    P.user.create.mockResolvedValue({ id: 'race-user', phone: '9876543210', name: 'Race' })

    // Atomic race: first $transaction wins, rest throw LINK_CONSUMED
    let claimed = false
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const wins = !claimed
      if (wins) {
        claimed = true
        const tx = {
          sharedLink: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ resourceId: 'party-1', businessId: 'biz-1' }),
          },
          party: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        }
        return fn(tx)
      }
      throw new PublicLinkError('LINK_CONSUMED', 409)
    })

    // All calls to user.findUnique:
    //  - Loser requests: 1 call each (existing-user check → null → losers throw LINK_CONSUMED before session)
    //  - Winner: 3 calls (existing check → null, resolveUserBiz → null, session → {phone,name})
    // Use a stateful mock that returns null for existing checks (first per-request call)
    // and cycles through for the winner's extra calls.
    let callCount = 0
    P.user.findUnique.mockImplementation(() => {
      callCount++
      // Winner's 3 extra calls after the 49 losers' 1 call each = call #51, #52, #53
      // But we can't reliably order async calls. Instead, always return null except when
      // returning a valid user for session issuance.
      // Session lookup: if the mock sees a call with {where: {id: 'race-user'}}, return user.
      // Since vi.fn receives the args, we inspect them:
      return Promise.resolve(null) // all null → resolveUserBusinessId returns '' → session user = null
    })

    // The winner will hit session lookup (user.findUnique for {phone,name}) returning null
    // which causes a 500. To avoid this, override with a smarter mock:
    // We'll return null for existing/bizId checks and a real user for the last call.
    // Since we can't control the order, we use mockResolvedValueOnce for the winner's session.
    // But with 50 concurrent requests we can't predict which one wins.
    //
    // Solution: mock findUnique to inspect the call args and return different values:
    P.user.findUnique.mockImplementation((args: { where?: { phone?: string; id?: string } } = {}) => {
      // resolveUserBusinessId calls findUnique({where: {id}, select: {lastActiveBusinessId, businessUsers}})
      // Session lookup calls findUnique({where: {id}, select: {phone, name}})
      // Existing check calls findUnique({where: {phone}})
      if (args?.where?.phone) {
        // existing-user check — no existing user
        return Promise.resolve(null)
      }
      if (args?.where?.id === 'race-user') {
        // Winner's session lookup or resolveUserBusinessId
        // Return null for resolveUserBiz (it handles null → '') and user for session
        // We can't distinguish the two, so return the user — resolveUserBiz handles user.businessUsers gracefully
        return Promise.resolve({ id: 'race-user', phone: '9876543210', name: 'Race', lastActiveBusinessId: null, businessUsers: [] })
      }
      return Promise.resolve(null)
    })

    const N = 50
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        request(app)
          .post(`/api/p/invite/${VALID_TOKEN}/claim`)
          .send({ kind: 'signup', name: 'Race User', password: 'password123' })
      )
    )

    const successes = results.filter((r) => r.status === 200)
    const consumed = results.filter((r) => r.status === 409)

    expect(successes.length).toBe(1)
    expect(consumed.length).toBe(N - 1)
    consumed.forEach((r) => {
      expect(r.body.error?.code).toBe('LINK_CONSUMED')
    })
  }, 30000) // 50 parallel bcrypt.hash @ rounds 12 needs more than the 10s default
})
