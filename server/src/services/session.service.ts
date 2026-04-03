/**
 * Multi-device session management — built on RefreshToken model.
 * Lists active sessions, force-logout specific devices.
 */

import { prisma } from '../lib/prisma.js'
import { blacklistUser } from '../lib/token-blacklist.js'

export interface SessionInfo {
  id: string
  deviceInfo: string | null
  createdAt: Date
  isCurrent: boolean
}

/** List all active sessions (non-expired refresh tokens) for a user */
export async function listSessions(userId: string, currentTokenId?: string): Promise<SessionInfo[]> {
  const tokens = await prisma.refreshToken.findMany({
    where: {
      userId,
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

/** Revoke a specific session by deleting its refresh token */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const token = await prisma.refreshToken.findFirst({
    where: { id: sessionId, userId },
  })

  if (!token) return false

  await prisma.refreshToken.delete({ where: { id: sessionId } })
  return true
}

/** Revoke ALL sessions except the current one (panic button) */
export async function revokeAllSessions(userId: string, currentTokenId?: string): Promise<number> {
  const where: Record<string, unknown> = { userId }
  if (currentTokenId) {
    where.id = { not: currentTokenId }
  }

  const result = await prisma.refreshToken.deleteMany({ where })

  // Blacklist user's existing access tokens — forces re-auth on next request
  await blacklistUser(userId)

  return result.count
}
