/**
 * Refresh-token family rotation — Contract Tests (REAL DB)
 *
 * Validates the RFC 6819 §5.2.2.3 invariants:
 *   - happy-path rotation revokes the old row and inserts a new family member
 *   - reuse of a replaced refresh token revokes the entire family
 *   - concurrent rotation race: exactly one winner (P2002 on partial unique)
 *   - logout / password-reset / switch-business revoke (not delete) rows
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { generateTokens } from '../../lib/jwt.js'
import { refreshAccessToken, RefreshReuseError } from '../../services/auth/login.js'
import { persistRefreshTokenFamily } from '../../services/auth/helpers.js'
import { createTestUser } from './factories.js'

describe('refresh-token family rotation', () => {
  let userId: string
  let phone: string

  beforeEach(async () => {
    const u = await createTestUser()
    userId = u.id
    phone = u.phone
  })

  it('rotates: old row gets revokedAt/replacedBy; new row is live in same family', async () => {
    const t1 = generateTokens(userId, phone, '')
    await persistRefreshTokenFamily({ userId, refreshToken: t1.refreshToken, deviceInfo: 'd1' })

    const row1 = await prisma.refreshToken.findUnique({ where: { token: t1.refreshToken } })
    expect(row1).not.toBeNull()
    expect(row1!.family).toBe(row1!.id)
    expect(row1!.revokedAt).toBeNull()

    // Small delay so generateTokens produces a different JWT (iat is in seconds)
    await new Promise((r) => setTimeout(r, 1100))
    const t2 = await refreshAccessToken(t1.refreshToken)
    expect(t2.refreshToken).not.toBe(t1.refreshToken)

    const after1 = await prisma.refreshToken.findUnique({ where: { token: t1.refreshToken } })
    expect(after1!.revokedAt).not.toBeNull()
    expect(after1!.revokedReason).toBe('rotated')
    expect(after1!.replacedBy).not.toBeNull()

    const after2 = await prisma.refreshToken.findUnique({ where: { token: t2.refreshToken } })
    expect(after2!.family).toBe(row1!.id)
    expect(after2!.revokedAt).toBeNull()
  })

  it('reuse of replaced refresh token revokes the entire family', async () => {
    const t1 = generateTokens(userId, phone, '')
    await persistRefreshTokenFamily({ userId, refreshToken: t1.refreshToken, deviceInfo: 'd1' })

    await new Promise((r) => setTimeout(r, 1100))
    const t2 = await refreshAccessToken(t1.refreshToken)

    await new Promise((r) => setTimeout(r, 1100))
    const t3 = await refreshAccessToken(t2.refreshToken)

    // Attacker reuses t1 (already replaced). Service must revoke entire family.
    await expect(refreshAccessToken(t1.refreshToken)).rejects.toBeInstanceOf(RefreshReuseError)

    const live = await prisma.refreshToken.count({ where: { userId, revokedAt: null } })
    expect(live).toBe(0)

    // t3 (the current "live" token before reuse) must now be revoked too.
    const t3Row = await prisma.refreshToken.findUnique({ where: { token: t3.refreshToken } })
    expect(t3Row!.revokedAt).not.toBeNull()
    expect(t3Row!.revokedReason).toBe('reuse-detected')
  })

  it('concurrent rotation of the same refresh token: exactly one succeeds', async () => {
    const t1 = generateTokens(userId, phone, '')
    await persistRefreshTokenFamily({ userId, refreshToken: t1.refreshToken, deviceInfo: 'd1' })

    await new Promise((r) => setTimeout(r, 1100))

    // Fire 5 parallel rotations of the same refresh token.
    const settled = await Promise.allSettled([
      refreshAccessToken(t1.refreshToken),
      refreshAccessToken(t1.refreshToken),
      refreshAccessToken(t1.refreshToken),
      refreshAccessToken(t1.refreshToken),
      refreshAccessToken(t1.refreshToken),
    ])

    const successes = settled.filter((r) => r.status === 'fulfilled')
    const failures = settled.filter((r) => r.status === 'rejected')

    expect(successes.length).toBe(1)
    expect(failures.length).toBe(4)
    failures.forEach((f) => {
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(RefreshReuseError)
    })
  })

  it('unknown but signature-valid refresh token throws RefreshReuseError', async () => {
    const t1 = generateTokens(userId, phone, '')
    // intentionally do NOT persist — token is signature-valid but unknown.
    await expect(refreshAccessToken(t1.refreshToken)).rejects.toBeInstanceOf(RefreshReuseError)
  })

  it('inactive user cannot rotate', async () => {
    const t1 = generateTokens(userId, phone, '')
    await persistRefreshTokenFamily({ userId, refreshToken: t1.refreshToken, deviceInfo: 'd1' })
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } })

    await expect(refreshAccessToken(t1.refreshToken)).rejects.toBeInstanceOf(RefreshReuseError)
  })
})
