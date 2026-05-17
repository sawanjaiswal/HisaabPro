/**
 * lastContactedAt — canonical touch helpers (architecture §3.4, §3.5, §3.6).
 *
 * Single + bulk variants. Server-only writes — partyPatchSchema rejects this
 * field from any client PATCH (M2 / §3.6); the column is only ever set here
 * from share-log + reminder hooks.
 *
 * Idempotent UPDATE: setting `lastContactedAt = now()` is monotonic-ish — if
 * called twice on the same partyId in the same request the later write wins
 * and downstream queries (follow-ups, dormant scans) only ever observe the
 * most recent contact instant. No transaction is opened here; callers pass
 * either `tx` (when the call lives inside an existing $transaction — share
 * + bulk reminder paths) or `null` (single reminder path, see §0.3 race
 * note: external WhatsApp I/O cannot be wrapped in a tx).
 *
 * cross-tenant safety: every UPDATE WHERE clause includes `businessId` so a
 * compromised hook receiving an attacker-supplied partyId from another
 * tenant cannot mutate it (the row count for the WHERE will be 0, silently).
 */

import { prisma, type ExtendedPrismaClient } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

/**
 * Accept either the extended client OR an extended-tx callback parameter.
 * `Parameters<…$transaction[0]>[0]` gives us the exact tx type Prisma will
 * synthesize for *this* extended client, so call-sites inside `prisma.
 * $transaction((tx) => …)` type-check cleanly without `as any`.
 */
type ExtendedTxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]
type TxOrClient = ExtendedPrismaClient | ExtendedTxClient | null

/**
 * Touch a single party's lastContactedAt to `touchedAt` (defaults to now).
 * Pass `tx` when called inside an existing $transaction (share, bulk reminder);
 * pass `null` for fire-and-forget (single payment reminder — external I/O).
 */
export async function touchLastContacted(
  businessId: string,
  partyId: string,
  tx: TxOrClient = null,
  touchedAt: Date = new Date(),
): Promise<void> {
  const client = tx ?? prisma
  try {
    const result = await client.party.updateMany({
      where: { id: partyId, businessId },
      data: { lastContactedAt: touchedAt },
    })
    if (result.count === 0) {
      logger.warn('lastContacted.skip_no_match', { businessId, partyId })
    }
  } catch (err) {
    // Never let a touch failure crash the originating route — log + swallow.
    logger.error('lastContacted.touch_failed', {
      businessId,
      partyId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Bulk touch — used by bulk-reminder dispatch (§3.5). Issues a single
 * UPDATE ... WHERE id IN (...) rather than N round-trips.
 */
export async function touchLastContactedMany(
  businessId: string,
  partyIds: string[],
  tx: TxOrClient = null,
  touchedAt: Date = new Date(),
): Promise<void> {
  if (partyIds.length === 0) return
  const client = tx ?? prisma
  try {
    await client.party.updateMany({
      where: { id: { in: partyIds }, businessId },
      data: { lastContactedAt: touchedAt },
    })
  } catch (err) {
    logger.error('lastContacted.touch_many_failed', {
      businessId,
      partyCount: partyIds.length,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
