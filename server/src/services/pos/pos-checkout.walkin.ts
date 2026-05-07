/**
 * POS Walk-in Party Helper — returns or creates the sentinel "Walk-in Customer" party.
 * Handles concurrent creation races via P2002 catch + re-fetch.
 * MUST be called within a Prisma $transaction.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { Party } from '@prisma/client'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

/**
 * Get or create the walk-in sentinel party for a business.
 * Race-safe: if two concurrent checkouts both find null and attempt insert,
 * the loser catches P2002 (unique constraint) and re-fetches the winner's row.
 *
 * @param tx         - Prisma transaction client
 * @param businessId - Business owning the walk-in party
 */
export async function getOrCreateWalkInParty(tx: TxClient, businessId: string): Promise<Party> {
  const existing = await tx.party.findFirst({
    where: { businessId, isWalkIn: true },
  })

  if (existing) return existing

  try {
    const created = await tx.party.create({
      data: {
        businessId,
        name: 'Walk-in Customer',
        type: 'CUSTOMER',
        isWalkIn: true,
      },
    })
    return created
  } catch (err: unknown) {
    // P2002 = unique constraint violation — race winner already created the row
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      const raced = await tx.party.findFirst({
        where: { businessId, isWalkIn: true },
      })
      if (!raced) {
        throw new Error(`Walk-in party not found after P2002 for business=${businessId}`)
      }
      return raced
    }
    throw err
  }
}
