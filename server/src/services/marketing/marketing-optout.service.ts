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

export interface ListOptOutsQuery {
  limit: number
  cursor?: string
}

/**
 * Parties this business has opted out of marketing, newest opt-out first.
 *
 * Backs both the opt-out management page and the chip the parties list renders
 * on an opted-out party — the client has called this since PR3 and the route
 * did not exist, so every parties-list render logged a 404.
 */
export async function listOptOutParties(businessId: string, { limit, cursor }: ListOptOutsQuery) {
  const parties = await prisma.party.findMany({
    where: { businessId, isDeleted: false, marketingOptOut: true },
    select: {
      id: true,
      name: true,
      phone: true,
      marketingOptOut: true,
      marketingOptOutAt: true,
    },
    // marketingOptOutAt can be null on rows opted out before it was recorded,
    // so id is the tiebreaker that keeps the cursor stable.
    orderBy: [{ marketingOptOutAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = parties.length > limit
  const page = hasMore ? parties.slice(0, limit) : parties
  return { optOuts: page, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null }
}
