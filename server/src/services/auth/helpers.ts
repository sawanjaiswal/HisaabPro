import { prisma } from '../../lib/prisma.js'
import {
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../../config/security.js'

/**
 * Resolve the active businessId for a user.
 * Prefers lastActiveBusinessId if still valid, otherwise first active business.
 * Returns '' if the user has no active business.
 */
export async function resolveUserBusinessId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastActiveBusinessId: true,
      businessUsers: {
        where: { isActive: true, status: 'ACTIVE' },
        select: { businessId: true },
        orderBy: { joinedAt: 'asc' },
        take: 10,
      },
    },
  })

  if (!user || user.businessUsers.length === 0) return ''

  // Prefer lastActiveBusinessId if still valid
  if (user.lastActiveBusinessId) {
    const isValid = user.businessUsers.some(bu => bu.businessId === user.lastActiveBusinessId)
    if (isValid) return user.lastActiveBusinessId
  }

  return user.businessUsers[0].businessId
}

/** Sleep for `ms` milliseconds (used for progressive delay on failed login) */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Increment failed login counter; lock account after LOCKOUT_MAX_ATTEMPTS */
export async function recordFailedLogin(userId: string, currentAttempts: number): Promise<void> {
  const newAttempts = currentAttempts + 1
  const shouldLock = newAttempts >= LOCKOUT_MAX_ATTEMPTS

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttempts,
      lastFailedLoginAt: new Date(),
      ...(shouldLock && { accountLockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }),
    },
  })
}

/** Reset lockout state after a successful login */
export async function resetLoginAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      accountLockedUntil: null,
    },
  })
}
