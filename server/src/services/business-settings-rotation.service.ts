/**
 * Rotate the per-business public-booking HMAC secret.
 *
 * Bumps `Business.publicBookingHmacSecret` to a fresh 32 random bytes and
 * bulk-revokes every outstanding SharedLink for that business so previously
 * issued booking URLs stop verifying. Single transaction so a partial failure
 * cannot leave the secret rotated but old links still active.
 */

import { prisma } from '../lib/prisma.js'
import { generatePublicBookingSecret } from './public-booking-signature.js'
import logger from '../lib/logger.js'

export async function rotatePublicBookingSecret(
  businessId: string,
  actorUserId: string
): Promise<{ rotatedAt: Date; sharedLinksRevoked: number }> {
  const newSecret = new Uint8Array(generatePublicBookingSecret())
  const rotatedAt = new Date()

  const result = await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: { publicBookingHmacSecret: newSecret },
    })

    const revoked = await tx.sharedLink.updateMany({
      where: {
        businessId,
        resourceType: 'BOOKING',
        revokedAt: null,
      },
      data: { revokedAt: rotatedAt },
    })
    return { sharedLinksRevoked: revoked.count }
  })

  logger.info('[appointment] public-booking secret rotated', {
    businessId,
    actorUserId,
    sharedLinksRevoked: result.sharedLinksRevoked,
  })

  return { rotatedAt, sharedLinksRevoked: result.sharedLinksRevoked }
}

/**
 * Ensure a business has a public-booking secret; create one lazily on first
 * call. Returns the rotated/created status so the caller can audit.
 */
export async function ensurePublicBookingSecret(
  businessId: string
): Promise<{ created: boolean }> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { publicBookingHmacSecret: true },
  })
  if (biz?.publicBookingHmacSecret) return { created: false }

  await prisma.business.update({
    where: { id: businessId },
    data: { publicBookingHmacSecret: new Uint8Array(generatePublicBookingSecret()) },
  })
  return { created: true }
}
