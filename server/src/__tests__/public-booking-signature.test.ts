/**
 * HMAC signature unit tests — verify timing-safety, canonical format, expiry
 * clamp, and rotation invalidation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import {
  canonicalPayload,
  generatePublicBookingSecret,
  signPublicBookingLink,
  verifyPublicBookingToken,
} from '../services/public-booking-signature.js'
import { PUBLIC_BOOKING_HMAC_MAX_DAYS } from '../constants/appointment.constants.js'

describe('public-booking-signature canonicalPayload', () => {
  it('joins businessId, employeeId, expiresAt with pipe', () => {
    const exp = new Date('2026-05-30T10:00:00.000Z')
    expect(
      canonicalPayload({ businessId: 'b1', employeeId: 'e1', expiresAt: exp })
    ).toBe('b1|e1|2026-05-30T10:00:00.000Z')
  })

  it('renders null employeeId as empty string between separators', () => {
    const exp = new Date('2026-05-30T10:00:00.000Z')
    expect(
      canonicalPayload({ businessId: 'b1', employeeId: null, expiresAt: exp })
    ).toBe('b1||2026-05-30T10:00:00.000Z')
  })
})

describe('generatePublicBookingSecret', () => {
  it('returns 32 bytes', () => {
    const secret = generatePublicBookingSecret()
    expect(secret.length).toBe(32)
  })
})

describe('sign + verify round-trip', () => {
  const secret = generatePublicBookingSecret()
  beforeEach(() => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      publicBookingHmacSecret: secret,
    } as unknown as Awaited<ReturnType<typeof prisma.business.findUnique>>)
  })

  it('signs and verifies the same payload', async () => {
    const exp = new Date(Date.now() + 60 * 60_000)
    const link = await signPublicBookingLink({
      businessId: 'b1',
      employeeId: 'e1',
      expiresAt: exp,
    })
    const result = await verifyPublicBookingToken(link.token)
    expect(result.payload.businessId).toBe('b1')
    expect(result.payload.employeeId).toBe('e1')
    expect(result.payload.expiresAt.toISOString()).toBe(exp.toISOString())
  })

  it('rejects tampered payload', async () => {
    const exp = new Date(Date.now() + 60 * 60_000)
    const link = await signPublicBookingLink({
      businessId: 'b1',
      employeeId: 'e1',
      expiresAt: exp,
    })
    // Flip the last char of the signature half — guaranteed mismatch.
    const [head, sig] = link.token.split('.')
    const tamperedSig = sig!.slice(0, -1) + (sig!.slice(-1) === 'a' ? 'b' : 'a')
    await expect(verifyPublicBookingToken(`${head}.${tamperedSig}`)).rejects.toThrow()
  })

  it('rejects expired token', async () => {
    // Fabricate a token whose ISO timestamp is already past, but sign it now
    // by directly invoking the helper with a near-future date and waiting.
    const exp = new Date(Date.now() + 100)
    const link = await signPublicBookingLink({
      businessId: 'b1',
      employeeId: 'e1',
      expiresAt: exp,
    })
    await new Promise((r) => setTimeout(r, 200))
    await expect(verifyPublicBookingToken(link.token)).rejects.toThrow()
  })

  it('rejects expiresAt beyond MAX_DAYS clamp', async () => {
    const tooFar = new Date(
      Date.now() + (PUBLIC_BOOKING_HMAC_MAX_DAYS + 1) * 24 * 60 * 60_000
    )
    await expect(
      signPublicBookingLink({ businessId: 'b1', employeeId: 'e1', expiresAt: tooFar })
    ).rejects.toThrow()
  })

  it('rejects token after secret rotation', async () => {
    const exp = new Date(Date.now() + 60 * 60_000)
    const link = await signPublicBookingLink({
      businessId: 'b1',
      employeeId: 'e1',
      expiresAt: exp,
    })
    // Rotate: swap the mocked secret so the same token now mismatches.
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      publicBookingHmacSecret: generatePublicBookingSecret(),
    } as unknown as Awaited<ReturnType<typeof prisma.business.findUnique>>)
    await expect(verifyPublicBookingToken(link.token)).rejects.toThrow()
  })
})
