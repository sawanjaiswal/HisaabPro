/**
 * pin-lockout.service unit tests — Phase 6 PR3.
 *
 * Covers:
 *   - getLockState returns not-locked when pinLockedUntil is null or past
 *   - getLockState returns locked + retryAfterSec when pinLockedUntil is future
 *   - registerFailure increments pinAttempts atomically
 *   - registerFailure flips to locked at threshold (5th failure)
 *   - resetCounters clears both columns
 *   - missing settings row → registerFailure is a no-op
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getLockState,
  assertNotLocked,
  registerFailure,
  resetCounters,
} from '../pin-lockout.service.js'
import { prisma } from '../../../lib/prisma.js'

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
const USER_ID = 'user-test-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getLockState', () => {
  it('returns not-locked when pinLockedUntil is null', async () => {
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({ pinLockedUntil: null })
    expect(await getLockState(USER_ID)).toEqual({ locked: false })
  })

  it('returns not-locked when pinLockedUntil is in the past', async () => {
    const past = new Date(Date.now() - 60 * 1000)
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({ pinLockedUntil: past })
    expect(await getLockState(USER_ID)).toEqual({ locked: false })
  })

  it('returns locked + retryAfterSec when pinLockedUntil is in the future', async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000)
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({ pinLockedUntil: future })

    const state = await getLockState(USER_ID)
    expect(state.locked).toBe(true)
    expect(state.lockedUntil).toEqual(future)
    expect(state.retryAfterSec).toBeGreaterThan(290)
    expect(state.retryAfterSec).toBeLessThanOrEqual(300)
  })

  it('returns not-locked when no settings row exists', async () => {
    mockPrisma.userAppSettings.findUnique.mockResolvedValue(null)
    expect(await getLockState(USER_ID)).toEqual({ locked: false })
  })
})

describe('assertNotLocked', () => {
  it('does nothing when state.locked is false', () => {
    expect(() => assertNotLocked({ locked: false })).not.toThrow()
  })

  it('throws 429 RATE_LIMITED with retryAfter when state.locked is true', () => {
    expect(() => assertNotLocked({ locked: true, retryAfterSec: 1800 })).toThrowError(
      expect.objectContaining({ statusCode: 429, code: 'RATE_LIMITED' }),
    )
  })
})

describe('registerFailure', () => {
  it('no-op when no settings row exists (returns not-locked, no writes)', async () => {
    mockPrisma.userAppSettings.findUnique.mockResolvedValue(null)
    expect(await registerFailure(USER_ID)).toEqual({ locked: false })
    expect(mockPrisma.userAppSettings.update).not.toHaveBeenCalled()
  })

  it('increments pinAttempts atomically below threshold (returns not-locked)', async () => {
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({ id: 'set-1' })
    mockPrisma.userAppSettings.update.mockResolvedValue({ pinAttempts: 3 })

    expect(await registerFailure(USER_ID)).toEqual({ locked: false })
    expect(mockPrisma.userAppSettings.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER_ID },
      data: { pinAttempts: { increment: 1 } },
    }))
    // Only one update — not yet locked.
    expect(mockPrisma.userAppSettings.update).toHaveBeenCalledTimes(1)
  })

  it('flips to locked when post-increment hits threshold (5 attempts)', async () => {
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({ id: 'set-1' })
    // First call: returns the post-increment pinAttempts (=5, threshold)
    // Second call: the lockout-flip write (pinAttempts=0, pinLockedUntil=...)
    mockPrisma.userAppSettings.update
      .mockResolvedValueOnce({ pinAttempts: 5 })
      .mockResolvedValueOnce({})

    const result = await registerFailure(USER_ID)
    expect(result.locked).toBe(true)
    expect(result.lockedUntil).toBeInstanceOf(Date)
    expect(result.retryAfterSec).toBe(30 * 60)
    expect(mockPrisma.userAppSettings.update).toHaveBeenCalledTimes(2)
    // Second call writes the lockout
    expect(mockPrisma.userAppSettings.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pinAttempts: 0, pinLockedUntil: expect.any(Date) }),
    }))
  })

  it('race safety — two parallel failures both call increment; the one that crosses threshold flips lockout', async () => {
    // Sequentially: 1st call → attempts=4 (still below); 2nd call → attempts=5 (flip).
    // We assert that even called in parallel, each invocation reads its own
    // post-increment value (atomic Prisma op) and only the second flips the lock.
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({ id: 'set-1' })
    mockPrisma.userAppSettings.update
      .mockResolvedValueOnce({ pinAttempts: 4 })
      .mockResolvedValueOnce({ pinAttempts: 5 })
      .mockResolvedValueOnce({})

    const [r1, r2] = await Promise.all([
      registerFailure(USER_ID),
      registerFailure(USER_ID),
    ])

    const lockedResults = [r1, r2].filter((r) => r.locked)
    expect(lockedResults).toHaveLength(1)
  })
})

describe('resetCounters', () => {
  it('clears pinAttempts + pinLockedUntil', async () => {
    mockPrisma.userAppSettings.findUnique.mockResolvedValue({ id: 'set-1' })
    mockPrisma.userAppSettings.update.mockResolvedValue({})

    await resetCounters(USER_ID)

    expect(mockPrisma.userAppSettings.update).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { pinAttempts: 0, pinLockedUntil: null },
    })
  })

  it('no-op when no settings row exists (avoids P2025)', async () => {
    mockPrisma.userAppSettings.findUnique.mockResolvedValue(null)
    await resetCounters(USER_ID)
    expect(mockPrisma.userAppSettings.update).not.toHaveBeenCalled()
  })
})
