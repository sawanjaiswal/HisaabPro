/**
 * Business resolution helper — shared across all route files.
 * Resolves the active businessId for the authenticated user.
 */

import { prisma } from './prisma.js'
import { unauthorizedError } from './errors.js'

/**
 * Resolve the user's active business.
 * Throws a 401 AppError if no active BusinessUser record is found.
 */
export async function resolveBusinessId(userId: string): Promise<string> {
  const bu = await prisma.businessUser.findFirst({
    where: { userId, isActive: true },
    select: { businessId: true },
  })
  if (!bu) throw unauthorizedError('No active business found for this user')
  return bu.businessId
}
