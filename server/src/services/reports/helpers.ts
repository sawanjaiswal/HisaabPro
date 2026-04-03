/**
 * Financial Reports — Shared helpers, constants, and types
 *
 * All amounts are stored in PAISE (integer). Results are returned in PAISE.
 *
 * Double-entry convention:
 *   ASSET / EXPENSE accounts: debit-normal (debit increases, credit decreases)
 *   LIABILITY / EQUITY / INCOME accounts: credit-normal (credit increases, debit decreases)
 */

import { prisma } from '../../lib/prisma.js'

export const REPORT_ROW_LIMIT = 5000

// ─── Internal types ────────────────────────────────────────────────────────────

export interface AccountNetMovement {
  accountId: string
  accountName: string
  accountType: string
  accountSubType: string | null
  netDebit: number
  netCredit: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sum journal line movements for accounts filtered by type, within a date range */
export async function getAccountMovements(
  businessId: string,
  dateGte: Date,
  dateLte: Date,
  accountTypes: string[],
): Promise<AccountNetMovement[]> {
  const aggregated = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      journalEntry: { businessId, status: 'POSTED', date: { gte: dateGte, lte: dateLte } },
      account: { type: { in: accountTypes }, isActive: true },
    },
    _sum: { debit: true, credit: true },
  })

  const accountIds = aggregated.map((a) => a.accountId)
  const accounts = await prisma.ledgerAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, name: true, type: true, subType: true },
  })
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  return aggregated
    .filter((agg) => accountMap.has(agg.accountId))
    .map((agg) => {
      const account = accountMap.get(agg.accountId)!
      return {
        accountId: agg.accountId,
        accountName: account.name,
        accountType: account.type,
        accountSubType: account.subType,
        netDebit: Number(agg._sum.debit ?? 0),
        netCredit: Number(agg._sum.credit ?? 0),
      }
    })
}

/**
 * Calculate account balances as of a specific date by summing journal movements.
 * Returns net balance (debit - credit for ASSET/EXPENSE, credit - debit for LIABILITY/EQUITY/INCOME).
 */
export async function getBalancesAsOf(
  businessId: string,
  asOf: Date,
): Promise<Map<string, { name: string; type: string; subType: string | null; netBalance: number }>> {
  const aggregated = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      journalEntry: {
        businessId,
        status: 'POSTED',
        date: { lte: asOf },
      },
    },
    _sum: { debit: true, credit: true },
  })

  const accountIds = aggregated.map((a) => a.accountId)
  const accounts = await prisma.ledgerAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, name: true, type: true, subType: true },
  })
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  const result = new Map<string, { name: string; type: string; subType: string | null; netBalance: number }>()

  for (const agg of aggregated) {
    const account = accountMap.get(agg.accountId)
    if (!account) continue

    const totalDebit = Number(agg._sum.debit ?? 0)
    const totalCredit = Number(agg._sum.credit ?? 0)

    let netBalance: number
    if (account.type === 'ASSET' || account.type === 'EXPENSE') {
      // Debit-normal: positive = debit balance
      netBalance = totalDebit - totalCredit
    } else {
      // Credit-normal: positive = credit balance
      netBalance = totalCredit - totalDebit
    }

    result.set(agg.accountId, { name: account.name, type: account.type, subType: account.subType, netBalance })
  }

  return result
}
