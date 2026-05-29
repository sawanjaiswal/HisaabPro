/**
 * Single-writer for the denormalised LedgerAccount.balance cache.
 *
 * SSOT for an account's balance is SUM(POSTED JournalLine debit/credit) run
 * through balanceDelta. `LedgerAccount.balance` is a *verified cache* of that
 * sum (kept because reports read it O(1); see reconcile-balances.ts for the
 * drift detector). To keep the cache a pure function of the journal lines,
 * EVERY balance mutation flows through this one function with the one canonical
 * sign convention (balanceDelta) — no caller computes a delta itself. A
 * matching guard in scripts/enforce.js fails the build if any other file
 * writes `ledgerAccount … balance`.
 *
 * `reverse: true` negates each delta — used when voiding/reversing a posted
 * entry or reopening an FY (undo the same lines that were applied on post).
 */
import { balanceDelta } from '../helpers.js'
import type { Tx } from './posting.types.js'

/** One journal leg, with its account's type so balanceDelta can sign it. Paise. */
export interface BalanceLine {
  accountId: string
  accountType: string
  debit: number
  credit: number
}

export async function postLedgerDeltas(
  tx: Tx,
  lines: BalanceLine[],
  opts: { reverse?: boolean } = {},
): Promise<void> {
  const sign = opts.reverse ? -1 : 1
  for (const line of lines) {
    const delta = sign * balanceDelta(line.accountType, line.debit, line.credit)
    if (delta !== 0) {
      await tx.ledgerAccount.update({
        where: { id: line.accountId },
        data: { balance: { increment: delta } },
      })
    }
  }
}

/**
 * Repair a single account's cached balance toward the journal-line truth, by a
 * signed correction (derived − stored). Lives here so EVERY balance mutation —
 * normal posting AND drift repair — flows through one file (the enforce.js
 * guard allowlists only this writer + chart-of-accounts genesis). Delta-based,
 * never a blind `set`: the correction is always computed against the derived
 * sum inside the reconciler's serializable transaction.
 */
export async function repairLedgerBalance(
  tx: Tx,
  accountId: string,
  correction: number,
): Promise<void> {
  if (correction !== 0) {
    await tx.ledgerAccount.update({
      where: { id: accountId },
      data: { balance: { increment: correction } },
    })
  }
}
