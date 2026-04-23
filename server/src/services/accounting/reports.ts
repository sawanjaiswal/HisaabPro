/**
 * Accounting Reports — Trial Balance, Ledger Report, Day Book.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { DEBIT_NORMAL_TYPES, balanceDelta } from './helpers.js'

// ─── Trial Balance ─────────────────────────────────────────────────────────────

/**
 * Trial Balance — all accounts with cumulative debit/credit totals from POSTED lines.
 * If asOf is provided, only lines from entries dated <= asOf are included.
 * The sum of all debit totals must equal sum of all credit totals (double-entry check).
 */
export async function getTrialBalance(businessId: string, asOf?: Date) {
  const dateFilter = asOf ? { date: { lte: asOf } } : {}

  const accounts = await prisma.ledgerAccount.findMany({
    where: { businessId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      subType: true,
      journalLines: {
        where: {
          journalEntry: {
            businessId,
            status: 'POSTED',
            ...dateFilter,
          },
        },
        select: { debit: true, credit: true },
      },
    },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
    take: 500, // chart of accounts: typically < 500 accounts per business
  })

  let grandTotalDebit = 0
  let grandTotalCredit = 0

  const rows = accounts.map((account) => {
    const totalDebit = account.journalLines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = account.journalLines.reduce((sum, l) => sum + l.credit, 0)
    grandTotalDebit += totalDebit
    grandTotalCredit += totalCredit

    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType,
      totalDebit,
      totalCredit,
      // Net balance for display convenience (positive = debit-side for ASSET/EXPENSE)
      netBalance: DEBIT_NORMAL_TYPES.has(account.type)
        ? totalDebit - totalCredit
        : totalCredit - totalDebit,
    }
  })

  return {
    asOf: asOf ?? null,
    rows,
    grandTotalDebit,
    grandTotalCredit,
    isBalanced: grandTotalDebit === grandTotalCredit,
  }
}

// ─── Ledger Report ─────────────────────────────────────────────────────────────

/**
 * Ledger Report — all POSTED journal lines for a single account, with running balance.
 */
export async function getLedgerReport(
  businessId: string,
  accountId: string,
  from?: Date,
  to?: Date,
) {
  const account = await prisma.ledgerAccount.findFirst({
    where: { id: accountId, businessId },
    select: { id: true, code: true, name: true, type: true, subType: true, balance: true },
  })
  if (!account) throw notFoundError('Ledger account')

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        businessId,
        status: 'POSTED',
        ...(from || to
          ? {
              date: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
    },
    include: {
      journalEntry: {
        select: { id: true, entryNumber: true, date: true, narration: true, type: true },
      },
    },
    orderBy: [{ journalEntry: { date: 'asc' } }, { journalEntry: { entryNumber: 'asc' } }],
    take: 1000, // report: bounded by date range filter
  })

  let runningBalance = 0
  const entries = lines.map((line) => {
    const delta = balanceDelta(account.type, line.debit, line.credit)
    runningBalance += delta
    return {
      lineId: line.id,
      entryId: line.journalEntry.id,
      entryNumber: line.journalEntry.entryNumber,
      date: line.journalEntry.date,
      type: line.journalEntry.type,
      narration: line.narration ?? line.journalEntry.narration,
      debit: line.debit,
      credit: line.credit,
      runningBalance,
    }
  })

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType,
      currentBalance: account.balance,
    },
    from: from ?? null,
    to: to ?? null,
    entries,
    totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
    totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
  }
}

// ─── Day Book ──────────────────────────────────────────────────────────────────

/**
 * Day Book — all journal entries (with full lines) for a given date.
 */
export async function getDayBook(businessId: string, date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const entries = await prisma.journalEntry.findMany({
    where: {
      businessId,
      status: 'POSTED',
      date: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { entryNumber: 'asc' },
  })

  const totalDebit = entries.reduce((sum, e) => sum + e.totalDebit, 0)
  const totalCredit = entries.reduce((sum, e) => sum + e.totalCredit, 0)

  return {
    date: startOfDay,
    entries,
    totalDebit,
    totalCredit,
    entryCount: entries.length,
  }
}
