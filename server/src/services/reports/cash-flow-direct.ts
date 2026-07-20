/**
 * Cash Flow — Direct Method
 *
 * The indirect statement in `cash-flow.ts` starts from net profit and adjusts
 * for working capital. This one reads the cash and bank ledgers directly: every
 * posted entry that moves CASH/BANK is classified by what sat on the other side
 * of it. That is the view an MSME owner actually recognises — "money in from
 * sales, money out to suppliers" — and it is what mockup #69 shows.
 *
 * All amounts are PAISE (integer).
 */

import { prisma } from '../../lib/prisma.js'

/** Entries scanned per period. Beyond this the totals are flagged as partial
 *  rather than silently under-reported. */
const MAX_ENTRIES = 20_000

const CASH_SUBTYPES = ['CASH', 'BANK']

export interface CashFlowDirect {
  inflows: { cashSales: number; receivablesReceived: number; other: number; total: number }
  outflows: { purchases: number; expenses: number; other: number; total: number }
  netCashFlow: number
  /** True when the period held more entries than one read can cover. */
  partial: boolean
}

interface LineRow {
  debit: number
  credit: number
  account: { type: string; subType: string | null }
}

function emptyResult(partial: boolean): CashFlowDirect {
  return {
    inflows: { cashSales: 0, receivablesReceived: 0, other: 0, total: 0 },
    outflows: { purchases: 0, expenses: 0, other: 0, total: 0 },
    netCashFlow: 0,
    partial,
  }
}

function isCashLine(line: LineRow): boolean {
  return line.account.type === 'ASSET' && CASH_SUBTYPES.includes(line.account.subType ?? '')
}

/** Which inflow bucket a positive movement against this counter-account belongs to. */
function inflowBucket(account: LineRow['account']): 'cashSales' | 'receivablesReceived' | 'other' {
  if (account.type === 'INCOME') return 'cashSales'
  if (account.type === 'ASSET' && account.subType === 'RECEIVABLE') return 'receivablesReceived'
  return 'other'
}

/** Which outflow bucket a negative movement against this counter-account belongs to. */
function outflowBucket(account: LineRow['account']): 'purchases' | 'expenses' | 'other' {
  if (account.subType === 'PURCHASE' || account.subType === 'INVENTORY') return 'purchases'
  if (account.type === 'EXPENSE') return 'expenses'
  return 'other'
}

export async function getCashFlowDirect(
  businessId: string,
  from: Date,
  to: Date,
): Promise<CashFlowDirect> {
  const entries = await prisma.journalEntry.findMany({
    where: {
      businessId,
      status: 'POSTED',
      date: { gte: from, lte: to },
      // Only entries that actually touch cash or bank can move cash.
      lines: { some: { account: { type: 'ASSET', subType: { in: CASH_SUBTYPES } } } },
    },
    select: {
      lines: {
        select: {
          debit: true,
          credit: true,
          account: { select: { type: true, subType: true } },
        },
      },
    },
    orderBy: { date: 'asc' },
    take: MAX_ENTRIES + 1,
  })

  const partial = entries.length > MAX_ENTRIES
  const scanned = partial ? entries.slice(0, MAX_ENTRIES) : entries
  if (scanned.length === 0) return emptyResult(partial)

  const result = emptyResult(partial)

  for (const entry of scanned) {
    const cashLines = entry.lines.filter(isCashLine)
    const counterLines = entry.lines.filter((l) => !isCashLine(l))
    if (cashLines.length === 0 || counterLines.length === 0) continue

    // Debit to cash = money in, credit to cash = money out.
    const netCash = cashLines.reduce((sum, l) => sum + l.debit - l.credit, 0)
    if (netCash === 0) continue

    // Most entries have exactly one counter-account, so this is an exact split.
    // Compound entries (a sale plus its tax line) get their cash movement spread
    // across counter-accounts in proportion to each one's own movement.
    const weights = counterLines.map((l) => Math.abs(l.debit - l.credit))
    const weightTotal = weights.reduce((s, w) => s + w, 0)
    if (weightTotal === 0) continue

    let allocated = 0
    counterLines.forEach((line, i) => {
      // The last counter-line absorbs the rounding remainder so the buckets
      // always add back up to the entry's cash movement to the paise.
      const isLast = i === counterLines.length - 1
      const share = isLast
        ? netCash - allocated
        : Math.round((netCash * weights[i]) / weightTotal)
      allocated += share
      if (share === 0) return

      if (share > 0) {
        result.inflows[inflowBucket(line.account)] += share
      } else {
        result.outflows[outflowBucket(line.account)] += -share
      }
    })
  }

  result.inflows.total =
    result.inflows.cashSales + result.inflows.receivablesReceived + result.inflows.other
  result.outflows.total =
    result.outflows.purchases + result.outflows.expenses + result.outflows.other
  result.netCashFlow = result.inflows.total - result.outflows.total

  return result
}
