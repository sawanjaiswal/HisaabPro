/**
 * WebAuthn credential CRUD operations.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

/** Delete a specific credential for a user. */
export async function deleteCredential(userId: string, credentialDbId: string): Promise<void> {
  await prisma.webAuthnCredential.deleteMany({
    where: { userId, id: credentialDbId },
  })
  logger.info('WebAuthn: credential deleted', { userId, credentialDbId })
}

/** List all credentials for a user. */
export async function listCredentials(userId: string) {
  return prisma.webAuthnCredential.findMany({
    where: { userId },
    select: {
      id: true,
      credentialId: true,
      deviceName: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}
