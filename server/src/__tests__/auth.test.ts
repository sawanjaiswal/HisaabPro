/**
 * Integration tests for auth routes.
 * Tests: csrf-token, dev-login, refresh, logout, switch-business, me
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  mockAuthPass,
  resetMocks,
  TEST_USER,
} from './helpers.js'

// Mock the auth service — all functions stubbed
vi.mock('../services/auth.service.js', () => ({
  devLogin: vi.fn(),
  refreshAccessToken: vi.fn(),
  getMe: vi.fn(),
  setTokenCookies: vi.fn(),
  clearTokenCookies: vi.fn(),
  switchBusiness: vi.fn(),
}))
import * as authService from '../services/auth.service.js'

const app = createApp()

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_USER = { id: TEST_USER.userId, phone: TEST_USER.phone, name: 'Dev Admin' }
const MOCK_TOKENS = { accessToken: 'access-tok', refreshToken: 'refresh-tok' }
const MOCK_ME = {
  user: MOCK_USER,
  businesses: [{ id: TEST_USER.businessId, name: 'Test Biz', businessType: 'retail', role: 'owner' }],
  activeBusiness: { id: TEST_USER.businessId, name: 'Test Biz', businessType: 'retail', role: 'owner' },
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Auth Routes', () => {
  beforeEach(() => {
    resetMocks()
    vi.clearAllMocks()
  })

  // ─── GET /api/auth/csrf-token ─────────────────────────────────────────────

  describe('GET /api/auth/csrf-token', () => {
    it('returns a CSRF token', async () => {
      const res = await anonAgent(app).get('/api/auth/csrf-token')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.csrfToken).toBeDefined()
      expect(typeof res.body.data.csrfToken).toBe('string')
    })
  })

  // ─── POST /api/auth/dev-login ─────────────────────────────────────────────

  describe('POST /api/auth/dev-login', () => {
    it('returns 200 for existing user login', async () => {
      vi.mocked(authService.devLogin).mockResolvedValue({
        verified: true,
        message: 'Login successful',
        isNewUser: false,
        user: MOCK_USER,
        tokens: MOCK_TOKENS,
      })
      vi.mocked(authService.getMe).mockResolvedValue(MOCK_ME)

      const res = await anonAgent(app)
        .post('/api/auth/dev-login')
        .send({ username: 'admin', password: 'admin123' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.isNewUser).toBe(false)
      expect(res.body.data.user.id).toBe(TEST_USER.userId)
      expect(res.body.data.businesses).toBeDefined()
      expect(authService.setTokenCookies).toHaveBeenCalledOnce()
    })

    it('returns 201 for new user login', async () => {
      vi.mocked(authService.devLogin).mockResolvedValue({
        verified: true,
        message: 'Login successful',
        isNewUser: true,
        user: MOCK_USER,
        tokens: MOCK_TOKENS,
      })
      vi.mocked(authService.getMe).mockResolvedValue(MOCK_ME)

      const res = await anonAgent(app)
        .post('/api/auth/dev-login')
        .send({ username: 'admin', password: 'admin123' })

      expect(res.status).toBe(201)
      expect(res.body.data.isNewUser).toBe(true)
    })

    it('returns 400 for invalid credentials', async () => {
      vi.mocked(authService.devLogin).mockResolvedValue({
        verified: false,
        message: 'Invalid username or password',
      })

      const res = await anonAgent(app)
        .post('/api/auth/dev-login')
        .send({ username: 'admin', password: 'wrong' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('LOGIN_FAILED')
    })

    it('returns 400 for missing fields', async () => {
      const res = await anonAgent(app)
        .post('/api/auth/dev-login')
        .send({ username: 'admin' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })
  })

  // ─── POST /api/auth/refresh ───────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('returns 200 on successful refresh', async () => {
      vi.mocked(authService.refreshAccessToken).mockResolvedValue(MOCK_TOKENS)

      const res = await anonAgent(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(authService.setTokenCookies).toHaveBeenCalledOnce()
    })

    it('returns 400 when refresh token is missing', async () => {
      const res = await anonAgent(app)
        .post('/api/auth/refresh')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('REFRESH_REQUIRED')
    })
  })

  // ─── POST /api/auth/logout ────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns 200 when authenticated', async () => {
      mockAuthPass()

      const res = await authAgent(app).post('/api/auth/logout').send({})

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.message).toBe('Logged out successfully')
      expect(authService.clearTokenCookies).toHaveBeenCalledOnce()
    })

    it('returns 401 without auth', async () => {
      const res = await anonAgent(app).post('/api/auth/logout').send({})

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })
  })

  // ─── GET /api/auth/me ─────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('returns user profile when authenticated', async () => {
      mockAuthPass()
      vi.mocked(authService.getMe).mockResolvedValue(MOCK_ME)

      const res = await authAgent(app).get('/api/auth/me')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.user.id).toBe(TEST_USER.userId)
      expect(res.body.data.businesses).toHaveLength(1)
      expect(res.body.data.activeBusiness).toBeDefined()
      expect(authService.getMe).toHaveBeenCalledWith(TEST_USER.userId, TEST_USER.businessId)
    })

    it('returns 401 without auth', async () => {
      const res = await anonAgent(app).get('/api/auth/me')

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('returns 404 when user not found', async () => {
      mockAuthPass()
      vi.mocked(authService.getMe).mockResolvedValue(null)

      const res = await authAgent(app).get('/api/auth/me')

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })
  })

  // ─── POST /api/auth/switch-business ───────────────────────────────────────

  describe('POST /api/auth/switch-business', () => {
    it('returns 200 on successful switch', async () => {
      mockAuthPass()
      const targetBizId = 'biz-target-1'
      vi.mocked(authService.switchBusiness).mockResolvedValue({
        tokens: MOCK_TOKENS,
        business: { id: targetBizId, name: 'Target Biz', businessType: 'retail' },
      })

      const res = await authAgent(app)
        .post('/api/auth/switch-business')
        .send({ businessId: targetBizId })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.business.id).toBe(targetBizId)
      expect(authService.setTokenCookies).toHaveBeenCalledOnce()
      expect(authService.switchBusiness).toHaveBeenCalledWith(
        TEST_USER.userId,
        TEST_USER.phone,
        targetBizId
      )
    })

    it('returns 400 when switching to current business', async () => {
      mockAuthPass()

      const res = await authAgent(app)
        .post('/api/auth/switch-business')
        .send({ businessId: TEST_USER.businessId })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('ALREADY_ACTIVE')
    })

    it('returns 400 when businessId is missing', async () => {
      mockAuthPass()

      const res = await authAgent(app)
        .post('/api/auth/switch-business')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 401 without auth', async () => {
      const res = await anonAgent(app)
        .post('/api/auth/switch-business')
        .send({ businessId: 'biz-target-1' })

      expect(res.status).toBe(401)
    })
  })
})
