/**
 * Resolve ledger accounts by their stable seeded `code` (SSOT).
 *
 * Posting maps reference accounts by code (e.g. '1200' = Accounts Receivable).
 * This resolver turns the set of codes a map produced into a code→{id,type}
 * map, scoped to the businessId so there is no cross-tenant resolution. A
 * missing required account is a loud config error (hard-atomic posting must
 * never silently skip a leg).
 */
import { validationError } from '../../../lib/errors.js'
import type { Tx } from './posting.types.js'

export interface ResolvedAccount {
  id: string
  type: string
}

/** Map of seeded code → resolved account, for the codes requested. */
export async function resolveAccounts(
  tx: Tx,
  businessId: string,
  codes: string[],
): Promise<Map<string, ResolvedAccount>> {
  const unique = [...new Set(codes)]
  const accounts = await tx.ledgerAccount.findMany({
    where: { businessId, code: { in: unique }, isActive: true },
    select: { id: true, code: true, type: true },
  })
  const byCode = new Map<string, ResolvedAccount>()
  for (const a of accounts) byCode.set(a.code, { id: a.id, type: a.type })

  const missing = unique.filter((c) => !byCode.has(c))
  if (missing.length > 0) {
    throw validationError(
      `GL posting: required system account(s) ${missing.join(', ')} missing for this business. ` +
        `Run seedDefaultAccounts / backfill-gl before posting.`,
    )
  }
  return byCode
}
