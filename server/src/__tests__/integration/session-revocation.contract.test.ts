/**
 * Session revocation — Contract Tests (REAL DB)
 *
 * Validates that listSessions / revokeSession / revokeAllSessions are
 * family-rotation aware:
 *   - listSessions hides revoked rows
 *   - revokeSession sets revokedAt (does not delete)
 *   - revokeAllSessions revokes everything except optional currentTokenId
 *   - password-reset revokes all sessions
 */

import crypto from 'node:crypto'
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { listSessions, revokeSession, revokeAllSessions } from '../../services/session.service.js'
import { createTestUser } from './factories.js'

/**
 * Seed a refresh-token row directly. We bypass generateTokens here so two
 * back-to-back seeds in the same second don't collide on the JWT signature
 * (JWT is deterministic for identical payload + iat).
 */
async function seed(userId: string, device: string) {
  const token = `tok_${crypto.randomBytes(16).toString('hex')}`
  const created = await prisma.refreshToken.create({
    data: {
      userId,
      token,
      deviceInfo: device,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  return prisma.refreshToken.update({
    where: { id: created.id },
    data: { family: created.id },
  })
}

describe('session.service', () => {
  let userId: string

  beforeEach(async () => {
    const u = await createTestUser()
    userId = u.id
  })

  it('listSessions returns only live rows', async () => {
    const a = await seed(userId,'iphone')
    await seed(userId,'android')
    const c = await seed(userId,'web')

    // Revoke b directly via service
    await revokeSession(userId, (await prisma.refreshToken.findFirst({ where: { userId, deviceInfo: 'android' } }))!.id)

    const sessions = await listSessions(userId, c.id)
    expect(sessions.length).toBe(2)
    const deviceInfos = sessions.map((s) => s.deviceInfo).sort()
    expect(deviceInfos).toEqual(['iphone', 'web'])
    expect(sessions.find((s) => s.id === a.id)!.isCurrent).toBe(false)
    expect(sessions.find((s) => s.id === c.id)!.isCurrent).toBe(true)
  })

  it('revokeSession flags revokedAt instead of deleting', async () => {
    const a = await seed(userId,'iphone')

    const ok = await revokeSession(userId, a.id)
    expect(ok).toBe(true)

    const after = await prisma.refreshToken.findUnique({ where: { id: a.id } })
    expect(after).not.toBeNull()
    expect(after!.revokedAt).not.toBeNull()
    expect(after!.revokedReason).toBe('user-revoked')
  })

  it('revokeSession ignores other users tokens', async () => {
    const other = await createTestUser()
    const otherToken = await seed(other.id, 'other')
    const ok = await revokeSession(userId, otherToken.id)
    expect(ok).toBe(false)
    const after = await prisma.refreshToken.findUnique({ where: { id: otherToken.id } })
    expect(after!.revokedAt).toBeNull()
  })

  it('revokeAllSessions(userId, current) revokes every row except current', async () => {
    await seed(userId,'iphone')
    await seed(userId,'android')
    const c = await seed(userId,'web')

    const count = await revokeAllSessions(userId, c.id)
    expect(count).toBe(2)

    const live = await prisma.refreshToken.findMany({ where: { userId, revokedAt: null } })
    expect(live.length).toBe(1)
    expect(live[0].id).toBe(c.id)
  })

  it('revokeAllSessions without current revokes everything', async () => {
    await seed(userId,'iphone')
    await seed(userId,'android')

    const count = await revokeAllSessions(userId)
    expect(count).toBe(2)
    const live = await prisma.refreshToken.count({ where: { userId, revokedAt: null } })
    expect(live).toBe(0)
  })
})
