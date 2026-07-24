/**
 * Marketing Opt-out Service (PR3)
 * Sets/clears party.marketingOptOut with audit log.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { createAuditEntry } from '../settings/audit.js'

export async function optOutParty(partyId: string, businessId: string, userId: string) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId, isDeleted: false },
    select: { id: true, name: true, marketingOptOut: true },
  })
  if (!party) return null

  if (party.marketingOptOut) {
    // Already opted out — idempotent
    return party
  }

  const updated = await prisma.party.update({
    where: { id: partyId },
    data: { marketingOptOut: true, marketingOptOutAt: new Date(), updatedAt: new Date() },
  })

  await createAuditEntry({
    businessId,
    userId,
    action: 'UPDATE',
    entityType: 'party',
    entityId: partyId,
    entityLabel: party.name,
    changes: { marketingOptOut: { from: false, to: true } },
  })

  logger.info('marketing.optout.set', { partyId, businessId, userId })
  return updated
}

export async function optInParty(partyId: string, businessId: string, userId: string) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId, isDeleted: false },
    select: { id: true, name: true, marketingOptOut: true },
  })
  if (!party) return null

  if (!party.marketingOptOut) {
    // Already opted in — idempotent
    return party
  }

  const updated = await prisma.party.update({
    where: { id: partyId },
    data: { marketingOptOut: false, marketingOptOutAt: null, updatedAt: new Date() },
  })

  await createAuditEntry({
    businessId,
    userId,
    action: 'UPDATE',
    entityType: 'party',
    entityId: partyId,
    entityLabel: party.name,
    changes: { marketingOptOut: { from: true, to: false } },
  })

  logger.info('marketing.optin.set', { partyId, businessId, userId })
  return updated
}
