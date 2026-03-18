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

/**
 * Validate that the authenticated user belongs to the requested business.
 * Used by routes that take :businessId from the URL path.
 * Throws 403 if the user is not an active member of that business.
 */
export async function validateBusinessAccess(
  userId: string,
  businessId: string
): Promise<void> {
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { isActive: true, status: true },
  })
  if (!bu || !bu.isActive || bu.status !== 'ACTIVE') {
    throw unauthorizedError('You do not have access to this business')
  }
}
