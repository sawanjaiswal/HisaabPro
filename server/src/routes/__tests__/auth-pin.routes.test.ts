/**
 * auth-pin.routes integration tests — Phase 6 PR3.
 *
 * Covers:
 *   - POST /verify: 200 on correct PIN; sets pin_gate_grace cookie
 *   - POST /verify: 401 INVALID_PIN on wrong PIN
 *   - POST /verify: 429 PIN_LOCKED when account in lockout window
 *   - POST /verify: 401 without auth token
 *   - POST /verify: 400 on bad PIN shape (non-digit, too short/long)
 *   - POST /reset/request: 200 happy path (OTP enqueued)
 *   - POST /reset/confirm: 200 happy path + 401 INVALID_OTP
 *
 * Uses supertest + the global setup.ts auto-mocked prisma + logger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../../app.js'
import {
  authAgent,
  anonAgent,
  mockAuthPass,
  resetMocks,
  getMockPrisma,
  TEST_USER,
} from '../../__tests__/helpers.js'
import { hashPin } from '../../services/security-pin/pin-hash.util.js'

// Mock the OTP module so /reset/request doesn't try to hit MSG91 in tests.
vi.mock('../../lib/otp.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/otp.js')>('../../lib/otp.js')
  return {
    ...actual,
    generateOTP: vi.fn(() => '123456'),
    hashOTP: vi.fn(async () => 'hashed-otp'),
    verifyOTP: vi.fn(async () => true),
    sendOTP: vi.fn(async () => true),
  }
})

const app = createApp()

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
})

describe('POST /api/auth/pin/verify', () => {
  it('returns 200 on correct PIN and sets pin_gate_grace cookie', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    const hash = hashPin('1234')
    // 1st findUnique: getLockState — not locked
    // 2nd findUnique: load pinHash for compare
    mockPrisma.userAppSettings.findUnique
      .mockResolvedValueOnce({ pinLockedUntil: null })
      .mockResolvedValueOnce({ pinHash: hash, pinEnabled: true })
      // 3rd findUnique: resetCounters checks settings exists
      .mockResolvedValueOnce({ id: 'set-1' })
    mockPrisma.userAppSettings.update.mockResolvedValue({})

    const res = await authAgent(app).post('/api/auth/pin/verify').send({ pin: '1234' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Set-Cookie includes pin_gate_grace
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined
    expect(cookies?.some((c) => c.startsWith('pin_gate_grace='))).toBe(true)
  })

  it('returns 401 INVALID_PIN on wrong PIN', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    const hash = hashPin('1234')
    mockPrisma.userAppSettings.findUnique
      .mockResolvedValueOnce({ pinLockedUntil: null })
      .mockResolvedValueOnce({ pinHash: hash, pinEnabled: true })
      // registerFailure: settings exists
      .mockResolvedValueOnce({ id: 'set-1' })
    mockPrisma.userAppSettings.update.mockResolvedValue({ pinAttempts: 2 })

    const res = await authAgent(app).post('/api/auth/pin/verify').send({ pin: '9999' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 429 PIN_LOCKED when account is in active lockout window', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    // Pre-check returns active future lockedUntil
    mockPrisma.userAppSettings.findUnique.mockResolvedValueOnce({
      pinLockedUntil: new Date(Date.now() + 10 * 60 * 1000),
    })

    const res = await authAgent(app).post('/api/auth/pin/verify').send({ pin: '1234' })

    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
  })

  it('returns 401 without an auth token', async () => {
    const res = await anonAgent(app).post('/api/auth/pin/verify').send({ pin: '1234' })
    expect(res.status).toBe(401)
  })

  it('returns 400 VALIDATION_ERROR on non-digit PIN', async () => {
    mockAuthPass()
    const res = await authAgent(app).post('/api/auth/pin/verify').send({ pin: 'abcd' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR on PIN shorter than 4 digits', async () => {
    mockAuthPass()
    const res = await authAgent(app).post('/api/auth/pin/verify').send({ pin: '12' })
    expect(res.status).toBe(400)
  })

  it('returns 400 VALIDATION_ERROR on PIN longer than 6 digits', async () => {
    mockAuthPass()
    const res = await authAgent(app).post('/api/auth/pin/verify').send({ pin: '1234567' })
    expect(res.status).toBe(400)
  })

  it('returns 400 VALIDATION_ERROR on unknown body key (strict mode)', async () => {
    mockAuthPass()
    const res = await authAgent(app).post('/api/auth/pin/verify').send({ pin: '1234', userId: 'other' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/pin/reset/request', () => {
  it('returns 200 and enqueues OTP + reset-token rows', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    // Auth middleware's findUnique runs first (returns id/isActive/isSuspended);
    // the reset service then calls findUnique again to read .phone. We give the
    // mock a value that satisfies BOTH consumers so call-ordering doesn't matter.
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TEST_USER.userId, isSuspended: false, isActive: true, phone: TEST_USER.phone,
    })
    mockPrisma.otpCode.create.mockResolvedValue({ id: 'otp-1' })
    mockPrisma.pinResetToken.create.mockResolvedValue({ id: 'tok-1' })

    const res = await authAgent(app).post('/api/auth/pin/reset/request').send({})

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.sent).toBe(true)
    expect(mockPrisma.otpCode.create).toHaveBeenCalled()
    expect(mockPrisma.pinResetToken.create).toHaveBeenCalled()
  })

  it('returns 401 without auth token', async () => {
    const res = await anonAgent(app).post('/api/auth/pin/reset/request').send({})
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/pin/reset/confirm', () => {
  it('returns 200 happy path — upserts pinHash + writes audit + consumes OTP', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    // Composite shape satisfies both auth-middleware and confirm-service findUnique callers.
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TEST_USER.userId, isSuspended: false, isActive: true, phone: TEST_USER.phone,
    })
    mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1', code: 'hashed', expiresAt: new Date(Date.now() + 60_000), attempts: 0,
    })
    mockPrisma.otpCode.update.mockResolvedValue({})
    mockPrisma.userAppSettings.upsert.mockResolvedValue({})
    mockPrisma.pinResetToken.findFirst.mockResolvedValue({ id: 'tok-1' })
    mockPrisma.pinResetToken.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const res = await authAgent(app).post('/api/auth/pin/reset/confirm')
      .send({ otp: '123456', newPin: '4321' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(mockPrisma.userAppSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: TEST_USER.userId },
    }))
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  it('returns 401 INVALID_OTP on wrong OTP', async () => {
    mockAuthPass()
    const otpModule = await import('../../lib/otp.js')
    vi.mocked(otpModule.verifyOTP).mockResolvedValueOnce(false)

    const mockPrisma = getMockPrisma()
    // Composite shape — see /reset/request test for rationale.
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TEST_USER.userId, isSuspended: false, isActive: true, phone: TEST_USER.phone,
    })
    mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1', code: 'hashed', expiresAt: new Date(Date.now() + 60_000), attempts: 0,
    })
    mockPrisma.otpCode.update.mockResolvedValue({})

    const res = await authAgent(app).post('/api/auth/pin/reset/confirm')
      .send({ otp: '000000', newPin: '4321' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 on missing newPin', async () => {
    mockAuthPass()
    const res = await authAgent(app).post('/api/auth/pin/reset/confirm').send({ otp: '123456' })
    expect(res.status).toBe(400)
  })
})
