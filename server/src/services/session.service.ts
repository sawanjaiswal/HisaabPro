/**
 * Multi-device session management — built on RefreshToken model.
 * Lists active sessions, force-logout specific devices.
 *
 * Family-rotation aware: rows are revoked (revokedAt set) rather than
 * deleted, so reuse-detection can still walk the audit chain.
 */

import { prisma } from '../lib/prisma.js'

export interface SessionInfo {
  id: string
  deviceInfo: string | null
  createdAt: Date
  isCurrent: boolean
}

/** List all active sessions (live refresh-token rows) for a user */
export async function listSessions(userId: string, currentTokenId?: string): Promise<SessionInfo[]> {
  const tokens = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      deviceInfo: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return tokens.map((t) => ({
    id: t.id,
    deviceInfo: t.deviceInfo,
    createdAt: t.createdAt,
    isCurrent: t.id === currentTokenId,
  }))
}

/** Revoke a specific session — flag revokedAt rather than delete row */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'user-revoked' },
  })
  return result.count > 0
}

/** Revoke ALL sessions except the current one (panic button) */
export async function revokeAllSessions(userId: string, currentTokenId?: string): Promise<number> {
  const where: Record<string, unknown> = { userId, revokedAt: null }
  if (currentTokenId) {
    where.id = { not: currentTokenId }
  }

  const result = await prisma.refreshToken.updateMany({
    where,
    data: { revokedAt: new Date(), revokedReason: 'revoke-all' },
  })
  return result.count
}
