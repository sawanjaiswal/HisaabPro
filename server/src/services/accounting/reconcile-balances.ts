/**
 * Drift detector / repairer for the LedgerAccount.balance cache.
 *
 * SSOT is SUM(POSTED JournalLine debit/credit) run through balanceDelta; the
 * stored `balance` is a verified cache of that sum. This module derives the
 * truth and compares it to the cache. Compare AND repair run inside ONE
 * Serializable transaction so the derived sum and the stored balance are read
 * in the same snapshot — a concurrent posting committing mid-run can't make a
 * repair clobber a correct balance with a stale value (the tx aborts/retries
 * instead). Journal lines are authoritative; balance is only ever moved toward
 * them, never the reverse.
 */
import { prisma } from '../../lib/prisma.js'
import { balanceDelta } from './helpers.js'
import { repairLedgerBalance } from './posting/ledger-deltas.js'
import type { Tx } from './posting/posting.types.js'

export interface DriftedAccount {
  accountId: string
  code: string
  stored: number
  derived: number
  diff: number
}

export interface ReconcileResult {
  checked: number
  drifted: DriftedAccount[]
  repaired: number
}

/**
 * Derived balance per account = Σ balanceDelta(type, debit, credit) over the
 * business's POSTED journal lines. Accounts with no POSTED lines are absent
 * from the map (their derived balance is 0). Runs inside the caller's tx.
 */
export async function computeDerivedBalances(
  businessId: string,
  tx: Tx,
): Promise<Map<string, number>> {
  const lines = await tx.journalEntryLine.findMany({
    where: { journalEntry: { businessId, status: 'POSTED' } },
    select: {
      debit: true,
      credit: true,
      account: { select: { id: true, type: true } },
    },
  })

  const derived = new Map<string, number>()
  for (const line of lines) {
    const prev = derived.get(line.account.id) ?? 0
    derived.set(line.account.id, prev + balanceDelta(line.account.type, line.debit, line.credit))
  }
  return derived
}

/**
 * Detect (and optionally repair) drift between stored and derived balances for
 * every ledger account in a business. Tenant-scoped: only touches accounts and
 * journal lines for `businessId`.
 */
export async function reconcileLedgerBalances(
  businessId: string,
  opts: { repair?: boolean } = {},
): Promise<ReconcileResult> {
  return prisma.$transaction(
    async (tx) => {
      const accounts = await tx.ledgerAccount.findMany({
        where: { businessId },
        select: { id: true, code: true, balance: true },
      })
      const derived = await computeDerivedBalances(businessId, tx)

      const drifted: DriftedAccount[] = []
      for (const account of accounts) {
        const derivedBalance = derived.get(account.id) ?? 0
        if (derivedBalance !== account.balance) {
          drifted.push({
            accountId: account.id,
            code: account.code,
            stored: account.balance,
            derived: derivedBalance,
            diff: derivedBalance - account.balance,
          })
        }
      }

      let repaired = 0
      if (opts.repair) {
        for (const row of drifted) {
          await repairLedgerBalance(tx, row.accountId, row.diff)
          repaired++
        }
      }

      return { checked: accounts.length, drifted, repaired }
    },
    { isolationLevel: 'Serializable' },
  )
}
