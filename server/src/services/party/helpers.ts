/**
 * Party helpers — ownership checks reused across sub-modules.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'

/** Verify party belongs to business, throw 404 if not */
export async function requireParty(businessId: string, partyId: string) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: { id: true },
  })
  if (!party) throw notFoundError('Party')
  return party
}

/** Verify party group belongs to business, throw 404 if not */
export async function requireGroup(businessId: string, groupId: string) {
  const group = await prisma.partyGroup.findFirst({
    where: { id: groupId, businessId },
  })
  if (!group) throw notFoundError('Party group')
  return group
}
