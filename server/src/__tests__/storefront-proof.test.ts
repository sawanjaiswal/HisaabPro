/**
 * Storefront PR4 proof tests — Epic C (#121).
 *
 * Verifies the required proof gates from TASKS_EPIC_C_customer_facing.md:
 *   - PATCH with reserved slug "admin" → 400 RESERVED_SLUG
 *   - PATCH with invalid slug "Foo Bar!" → 400 INVALID_SLUG
 *   - PATCH with valid slug → 200, lowercased
 *   - PATCH with another business's taken slug → 409 SLUG_TAKEN
 *   - GET /api/p/store/<slug> when isPublic=false → 404
 *   - GET /api/p/store/<slug> when isPublic=true → 200 with sanitized payload (no costPrice)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockBusiness = {
  id: 'biz-001',
  name: 'Test Business',
  phone: '9999999999',
  storefrontSlug: null,
  storefrontIsPublic: false,
  storefrontTagline: null,
  storefrontTheme: 'LIGHT',
  storefrontWhatsapp: null,
  storefrontProducts: [],
}

vi.mock('../lib/prisma.js', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ isSuspended: false, isActive: true }),
    },
    business: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    storefrontProduct: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    sharedLink: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((fn: unknown) =>
      typeof fn === 'function' ? fn(mockPrisma) : Promise.resolve(fn)
    ),
  }
  return { prisma: mockPrisma }
})

vi.mock('../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../middleware/csrf.js', () => ({
  csrfProtection: (_r: unknown, _s: unknown, n: () => void) => n(),
}))
vi.mock('../middleware/rate-limit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/rate-limit.js')>()
  const p = (_r: unknown, _s: unknown, n: () => void) => n()
  return {
    ...actual,
    apiRateLimiter: p,
    authRateLimiter: p,
    userMutationLimiter: p,
    sensitiveMutationLimiter: p,
    sensitiveRateLimiter: p,
    otpRateLimiter: p,
    devLoginRateLimiter: p,
    couponValidateRateLimiter: p,
    couponIpRateLimiter: p,
    createRateLimiter: () => p,
  }
})
vi.mock('../middleware/public/rate-limit.js', () => ({
  publicRateLimiter: () => (_r: unknown, _s: unknown, n: () => void) => n(),
}))
vi.mock('../middleware/subscription-gate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/subscription-gate.js')>()
  const p = (_r: unknown, _s: unknown, n: () => void) => n()
  return {
    ...actual,
    requireFeature: () => p,
    requireSubscription: () => p,
    requireQuota: () => p,
    subscriptionGate: p,
  }
})
vi.mock('../lib/token-blacklist.js', () => ({
  blacklistToken: vi.fn(),
  isBlacklisted: vi.fn().mockReturnValue(false),
  isUserBlacklisted: vi.fn().mockReturnValue(false),
  blacklistUser: vi.fn(),
}))

// ---------------------------------------------------------------------------
// App + auth token
// ---------------------------------------------------------------------------

import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

// vitest.config.ts sets JWT_SECRET=test-secret-key-that-is-at-least-32-chars-long
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-secret-key-that-is-at-least-32-chars-long'

function makeToken(businessId = 'biz-001') {
  return jwt.sign(
    { userId: 'user-001', phone: '9999999999', businessId, type: 'access' },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' }
  )
}

import { createApp } from '../app.js'

const app = createApp()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Storefront PR4 proof gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Auth middleware needs user lookup to succeed
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isSuspended: false,
      isActive: true,
    })

    // Default: getStorefrontSettings
    ;(prisma.business.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockBusiness,
      storefrontProducts: [],
    })

    // Default: no slug conflict
    ;(prisma.business.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    // Default: update succeeds
    ;(prisma.business.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusiness)
  })

  // ── PATCH slug validation ────────────────────────────────────────────────

  it('PATCH with reserved slug "admin" → 400 RESERVED_SLUG', async () => {
    const token = makeToken()
    const res = await request(app)
      .patch('/api/businesses/me/storefront')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'admin' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    // Zod refine message or AppError code
    const body = JSON.stringify(res.body)
    expect(body).toMatch(/RESERVED_SLUG/)
  })

  it('PATCH with invalid slug "Foo Bar!" → 400 INVALID_SLUG', async () => {
    const token = makeToken()
    const res = await request(app)
      .patch('/api/businesses/me/storefront')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'Foo Bar!' })

    expect(res.status).toBe(400)
    const body = JSON.stringify(res.body)
    expect(body).toMatch(/INVALID_SLUG/)
  })

  it('PATCH with valid slug → 200, slug stored lowercased', async () => {
    const token = makeToken()

    ;(prisma.business.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockBusiness,
      storefrontSlug: 'myshop',
      storefrontProducts: [],
    })

    const res = await request(app)
      .patch('/api/businesses/me/storefront')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'MyShop' }) // mixed-case input

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Confirm update was called with lowercased slug
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storefrontSlug: 'myshop' }),
      })
    )
  })

  it('PATCH with taken slug (another business) → 409 SLUG_TAKEN', async () => {
    const token = makeToken('biz-001')

    // Another business already owns this slug
    ;(prisma.business.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'biz-999',
    })

    const res = await request(app)
      .patch('/api/businesses/me/storefront')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'taken-slug' })

    expect(res.status).toBe(409)
    const body = JSON.stringify(res.body)
    expect(body).toMatch(/SLUG_TAKEN/)
  })

  // ── Public store ─────────────────────────────────────────────────────────

  it('GET /api/p/store/:slug when isPublic=false → 404', async () => {

    // findFirst returns null (store not public)
    ;(prisma.business.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await request(app).get('/api/p/store/myshop')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('GET /api/p/store/:slug when isPublic=true → 200 sanitized payload (no costPrice)', async () => {

    ;(prisma.business.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockBusiness,
      storefrontIsPublic: true,
      storefrontSlug: 'myshop',
      storefrontTagline: 'Fresh every day',
      storefrontTheme: 'LIGHT',
      storefrontWhatsapp: '919876543210',
      storefrontProducts: [
        {
          productId: 'prod-001',
          priceVisible: true,
          product: {
            name: 'Milk 500ml',
            salePrice: 3000,
            unit: { symbol: 'ltr' },
            // hostile fields that must NOT appear in response
            costPrice: 1500,
            purchasePrice: 1500,
            supplierName: 'Dairy Co',
          },
        },
      ],
    })

    const res = await request(app).get('/api/p/store/myshop')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const data = res.body.data
    expect(data.businessName).toBe('Test Business')
    expect(data.tagline).toBe('Fresh every day')
    expect(data.products).toHaveLength(1)
    expect(data.products[0].name).toBe('Milk 500ml')
    expect(data.products[0].price).toBe(3000)

    // Verify no hostile fields
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain('costPrice')
    expect(bodyStr).not.toContain('1500')
    expect(bodyStr).not.toContain('supplierName')
    expect(bodyStr).not.toContain('Dairy Co')
  })
})
