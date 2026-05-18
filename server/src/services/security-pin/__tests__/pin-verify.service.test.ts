/**
 * pin-verify.service unit tests — Phase 6 PR3.
 *
 * Covers:
 *   - success → cookie issued with fresh pf; counters reset
 *   - wrong pin → 401 INVALID_PIN; failure counter incremented
 *   - locked user → 429 PIN_LOCKED before bcrypt runs
 *   - timing-safe on missing-user / no-PIN (uses dummy hash; throws 401 INVALID_PIN)
 *   - structured-log emission on success + failure paths
 *
 * Per `__tests__/setup.ts`, prisma is auto-mocked via Proxy and logger is a
 * vi.fn() — we read its mock.calls to verify event emission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyUserPin } from '../pin-verify.service.js'
import { hashPin } from '../pin-hash.util.js'
import { prisma } from '../../../lib/prisma.js'
import logger from '../../../lib/logger.js'
import { issuePinGraceCookie } from '../pin-grace-cookie.js'

vi.mock('../pin-grace-cookie.js', async (importOriginal) => {
  // Wrap actual export so we can spy on issuePinGraceCookie.
  const actual = await importOriginal<typeof import('../pin-grace-cookie.js')>()
  return { ...actual, issuePinGraceCookie: vi.fn() }
})

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
const mockIssueCookie = issuePinGraceCookie as unknown as ReturnType<typeof vi.fn>
const mockLoggerInfo = logger.info as unknown as ReturnType<typeof vi.fn>
const mockLoggerWarn = logger.warn as unknown as ReturnType<typeof vi.fn>

const USER_ID = 'user-test-1'
const BIZ_ID = 'biz-test-1'
const CORRECT_PIN = '1234'
const WRONG_PIN = '9999'

// Stand-in for Express `res` — only res.cookie is touched in the success path
// (and only through the mocked issuePinGraceCookie helper above).
function fakeRes() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Parameters<typeof verifyUserPin>[0]['res']
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIssueCookie.mockReset()
})

describe('verifyUserPin — success path', () => {
  it('returns success, issues grace cookie with verified pinHash, resets lockout counters', async () => {
    const realHash = hashPin(CORRECT_PIN)
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({
      pinHash: realHash, pinEnabled: true, pinLockedUntil: null,
    })
    mockPrisma.userAppSettings.update.mockResolvedValue({})

    const res = fakeRes()
    const result = await verifyUserPin({ userId: USER_ID, businessId: BIZ_ID, pin: CORRECT_PIN, res })

    expect(result.success).toBe(true)
    expect(mockIssueCookie).toHaveBeenCalledWith(res, USER_ID, BIZ_ID, 'mutation', realHash)
    // Counters reset call: pinAttempts=0, pinLockedUntil=null
    expect(mockPrisma.userAppSettings.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER_ID },
      data: { pinAttempts: 0, pinLockedUntil: null },
    }))
    expect(mockLoggerInfo).toHaveBeenCalledWith('pin_verify.success', expect.objectContaining({ userId: USER_ID }))
  })
})

describe('verifyUserPin — wrong pin', () => {
  it('throws 401 INVALID_PIN and increments failure counter (not yet locked)', async () => {
    const realHash = hashPin(CORRECT_PIN)
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({
      pinHash: realHash, pinEnabled: true, pinLockedUntil: null,
    })
    // post-increment value still below threshold → no lockout flip
    mockPrisma.userAppSettings.update.mockResolvedValue({ pinAttempts: 1 })

    await expect(
      verifyUserPin({ userId: USER_ID, businessId: BIZ_ID, pin: WRONG_PIN, res: fakeRes() }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' })

    // Increment was called
    expect(mockPrisma.userAppSettings.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { pinAttempts: { increment: 1 } },
    }))
    // Cookie not issued
    expect(mockIssueCookie).not.toHaveBeenCalled()
    // Failure event emitted
    expect(mockLoggerWarn).toHaveBeenCalledWith('pin_verify.failure', expect.objectContaining({
      userId: USER_ID, lockoutTriggered: false,
    }))
  })

  it('flips to 429 PIN_LOCKED when the 5th failure trips the threshold', async () => {
    const realHash = hashPin(CORRECT_PIN)
    mockPrisma.userAppSettings.findUnique
      // pre-check (getLockState) — not locked
      .mockResolvedValueOnce({ pinLockedUntil: null })
      // load pinHash
      .mockResolvedValueOnce({ pinHash: realHash, pinEnabled: true })
      // registerFailure: settings exists
      .mockResolvedValueOnce({ id: 'set-1' })
    // post-increment value hits threshold → flip to locked
    mockPrisma.userAppSettings.update
      .mockResolvedValueOnce({ pinAttempts: 5 })
      .mockResolvedValueOnce({})

    await expect(
      verifyUserPin({ userId: USER_ID, businessId: BIZ_ID, pin: WRONG_PIN, res: fakeRes() }),
    ).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' })
  })
})

describe('verifyUserPin — locked account', () => {
  it('returns 429 PIN_LOCKED before bcrypt runs when pre-check shows active lockout', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000)
    mockPrisma.userAppSettings.findUnique.mockResolvedValueOnce({ pinLockedUntil: future })

    await expect(
      verifyUserPin({ userId: USER_ID, businessId: BIZ_ID, pin: CORRECT_PIN, res: fakeRes() }),
    ).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' })

    // findUnique called exactly once — bcrypt skipped, no second SELECT.
    expect(mockPrisma.userAppSettings.findUnique).toHaveBeenCalledTimes(1)
    expect(mockIssueCookie).not.toHaveBeenCalled()
  })
})

describe('verifyUserPin — missing user / no PIN set (timing-safe)', () => {
  it('throws 401 INVALID_PIN identical to wrong-pin (uses dummy hash, no enumeration leak)', async () => {
    // Pre-check: no settings row → null → not locked
    mockPrisma.userAppSettings.findUnique
      .mockResolvedValueOnce(null)
      // Load pinHash: still null (no PIN set)
      .mockResolvedValueOnce(null)
      // registerFailure: no settings → no-op
      .mockResolvedValueOnce(null)

    await expect(
      verifyUserPin({ userId: USER_ID, businessId: BIZ_ID, pin: CORRECT_PIN, res: fakeRes() }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' })

    expect(mockIssueCookie).not.toHaveBeenCalled()
  })
})
