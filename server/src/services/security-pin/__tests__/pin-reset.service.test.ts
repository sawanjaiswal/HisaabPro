/**
 * pin-reset.service unit tests — Phase 6 PR3.
 *
 * Covers:
 *   - requestPinReset: persists OtpCode + PinResetToken; calls sendOTP
 *   - confirmPinReset (happy): upserts new pinHash + clears lockout + writes audit
 *   - confirmPinReset (bad OTP): throws 401 INVALID_OTP + bumps OTP attempts
 *   - confirmPinReset (no OTP row): throws 401 INVALID_OTP
 *   - confirmPinReset (expired OTP): throws 401 INVALID_OTP
 *   - pf-design: old grace cookie's pf no longer matches new pinHash
 *
 * lib/otp.js is mocked so we don't hit MSG91 in tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestPinReset, confirmPinReset } from '../pin-reset.service.js'
import { prisma } from '../../../lib/prisma.js'
import { computePinFingerprint } from '../pin-grace-cookie.js'
import { hashPin } from '../pin-hash.util.js'

vi.mock('../../../lib/otp.js', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/otp.js')>('../../../lib/otp.js')
  return {
    ...actual,
    generateOTP: vi.fn(() => '123456'),
    hashOTP: vi.fn(async () => 'hashed-otp'),
    verifyOTP: vi.fn(),
    sendOTP: vi.fn(async () => true),
  }
})

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
const USER_ID = 'user-test-1'
const BIZ_ID = 'biz-test-1'
const PHONE = '9876543210'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requestPinReset', () => {
  it('persists OtpCode + PinResetToken and reports OTP sent', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phone: PHONE })
    mockPrisma.otpCode.create.mockResolvedValue({ id: 'otp-1' })
    mockPrisma.pinResetToken.create.mockResolvedValue({ id: 'tok-1' })

    const result = await requestPinReset({ userId: USER_ID })

    expect(result.sent).toBe(true)
    expect(result.message).toContain(PHONE)
    expect(mockPrisma.otpCode.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ phone: PHONE, code: 'hashed-otp' }),
    }))
    expect(mockPrisma.pinResetToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: USER_ID }),
    }))
  })

  it('throws 401 when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    await expect(requestPinReset({ userId: USER_ID })).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('confirmPinReset — happy path', () => {
  it('upserts new pinHash, clears lockout, consumes OTP + token, writes audit row', async () => {
    const otpModule = await import('../../../lib/otp.js')
    vi.mocked(otpModule.verifyOTP).mockResolvedValueOnce(true)

    mockPrisma.user.findUnique.mockResolvedValue({ phone: PHONE })
    mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1', code: 'hashed', expiresAt: new Date(Date.now() + 60_000), attempts: 0,
    })
    mockPrisma.otpCode.update.mockResolvedValue({})
    mockPrisma.userAppSettings.upsert.mockResolvedValue({})
    mockPrisma.pinResetToken.findFirst.mockResolvedValue({ id: 'tok-1' })
    mockPrisma.pinResetToken.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const result = await confirmPinReset({ userId: USER_ID, businessId: BIZ_ID, otp: '123456', newPin: '4321' })

    expect(result.success).toBe(true)
    // pinHash upsert wipes lockout + sets pinEnabled=true
    expect(mockPrisma.userAppSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER_ID },
      update: expect.objectContaining({
        pinEnabled: true, pinAttempts: 0, pinLockedUntil: null,
      }),
    }))
    // Audit row written
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'PIN_RESET', userId: USER_ID, businessId: BIZ_ID,
      }),
    }))
    // OTP consumed
    expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp-1' }, data: { verified: true },
    })
    // Reset token consumed
    expect(mockPrisma.pinResetToken.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tok-1' }, data: expect.objectContaining({ consumedAt: expect.any(Date) }),
    }))
  })

  it('old grace cookie pf no longer matches new pinHash after reset (v2.3 design payoff)', async () => {
    // Simulate: pre-reset pinHash = H_old; cookie carries pf(H_old).
    const oldHash = hashPin('1234')
    const oldPf = computePinFingerprint(oldHash)

    // Post-reset, pinHash rotates to H_new; pf(H_new) differs from cookie's pf.
    const newHash = hashPin('5678')
    const newPf = computePinFingerprint(newHash)

    expect(newPf).not.toBe(oldPf)
    // The middleware (require-recent-pin.ts) computes pf from the LATEST
    // UserAppSettings.pinHash; a stored cookie containing the old pf will
    // therefore fail verifyPinGraceCookie with reason='pin_rotated'.
  })
})

describe('confirmPinReset — failure paths', () => {
  it('throws 401 INVALID_OTP and bumps OTP attempts on wrong OTP', async () => {
    const otpModule = await import('../../../lib/otp.js')
    vi.mocked(otpModule.verifyOTP).mockResolvedValueOnce(false)

    mockPrisma.user.findUnique.mockResolvedValue({ phone: PHONE })
    mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1', code: 'hashed', expiresAt: new Date(Date.now() + 60_000), attempts: 0,
    })
    mockPrisma.otpCode.update.mockResolvedValue({})

    await expect(
      confirmPinReset({ userId: USER_ID, businessId: BIZ_ID, otp: '000000', newPin: '4321' }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' })

    // attempts++ called
    expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp-1' }, data: { attempts: { increment: 1 } },
    })
    // pinHash NOT rotated
    expect(mockPrisma.userAppSettings.upsert).not.toHaveBeenCalled()
  })

  it('throws 401 when no active OTP row exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phone: PHONE })
    mockPrisma.otpCode.findFirst.mockResolvedValue(null)

    await expect(
      confirmPinReset({ userId: USER_ID, businessId: BIZ_ID, otp: '123456', newPin: '4321' }),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws 401 when the OTP is expired', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phone: PHONE })
    mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1', code: 'hashed', expiresAt: new Date(Date.now() - 60_000), attempts: 0,
    })

    await expect(
      confirmPinReset({ userId: USER_ID, businessId: BIZ_ID, otp: '123456', newPin: '4321' }),
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})
