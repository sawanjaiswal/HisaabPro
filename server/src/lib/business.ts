/**
 * Business access helpers — shared across all route files.
 */

import { prisma } from './prisma.js'
import { unauthorizedError } from './errors.js'

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
