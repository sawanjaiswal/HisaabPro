/**
 * Party Ledger Service — running-balance ledger for a party over a date window.
 * Document/Payment/JournalEntryLine queries merged + sorted in JS; running
 * balance is a single O(n) integer pass. All amounts in PAISE (never float).
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import type { LedgerQuery, LedgerRow } from './ledger.types.js'
import { encodeCursor, decodeCursor } from './ledger.types.js'
import {
  DOC_VOUCHER_MAP,
  computeOpeningBalance,
  docTypesForFilter,
  endOfDay,
  mergeLedgerRows,
  startOfDay,
} from './ledger.utils.js'

export async function getPartyLedger(
  businessId: string,
  partyId: string,
  query: LedgerQuery,
) {
  // 1. Verify party belongs to this business
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: { id: true, name: true },
  })
  if (!party) throw notFoundError('Party')

  const fromDate = startOfDay(query.from)
  const toDate = endOfDay(query.to)
  const { voucherTypes, cursor: cursorStr, limit } = query

  // Decode cursor for pagination continuation
  const cursor = cursorStr ? decodeCursor(cursorStr) : null

  // 2. Opening balance — sum of all transactions strictly before `from`
  const [docBefore, payBefore, jeBefore] = await Promise.all([
    prisma.document.findMany({
      where: {
        businessId, partyId,
        documentDate: { lt: fromDate },
        isDeleted: false,
        type: { in: Object.keys(DOC_VOUCHER_MAP) },
      },
      select: { type: true, grandTotal: true },
    }),
    prisma.payment.findMany({
      where: { businessId, partyId, date: { lt: fromDate }, isDeleted: false },
      select: { type: true, amount: true },
    }),
    prisma.journalEntryLine.findMany({
      where: {
        partyId,
        journalEntry: {
          businessId, status: 'POSTED', date: { lt: fromDate },
          // Exclude auto-posted document/payment mirrors — those are already
          // represented by the Document/Payment rows above (avoids double-count).
          sourceType: { notIn: ['DOCUMENT', 'PAYMENT'] },
        },
      },
      select: { debit: true, credit: true },
    }),
  ])

  const openingBalance = computeOpeningBalance(docBefore, payBefore, jeBefore)

  // 3. Window queries for the [from, to] range
  const wantDocs = !voucherTypes || voucherTypes.some(v => ['SALE', 'PURCHASE', 'CN', 'DN'].includes(v))
  const wantPays = !voucherTypes || voucherTypes.includes('PAYMENT')
  const wantJe   = !voucherTypes || voucherTypes.includes('JE')

  const docTypes = docTypesForFilter(voucherTypes)

  const [docs, pays, jeLines] = await Promise.all([
    wantDocs ? prisma.document.findMany({
      where: {
        businessId, partyId,
        documentDate: { gte: fromDate, lte: toDate },
        isDeleted: false,
        type: docTypes ? { in: docTypes } : { in: Object.keys(DOC_VOUCHER_MAP) },
      },
      select: { id: true, type: true, grandTotal: true, documentDate: true, documentNumber: true, createdAt: true, party: { select: { name: true } }, _count: { select: { lineItems: true } } },
      orderBy: [{ documentDate: 'asc' }, { createdAt: 'asc' }],
    }) : Promise.resolve([]),

    wantPays ? prisma.payment.findMany({
      where: {
        businessId, partyId,
        date: { gte: fromDate, lte: toDate },
        isDeleted: false,
      },
      select: { id: true, type: true, amount: true, date: true, referenceNumber: true, mode: true, notes: true, createdAt: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }) : Promise.resolve([]),

    wantJe ? prisma.journalEntryLine.findMany({
      where: {
        partyId,
        journalEntry: {
          businessId, status: 'POSTED', date: { gte: fromDate, lte: toDate },
          // Exclude auto-posted document/payment mirrors — already represented
          // by the Document/Payment rows above (avoids double-count).
          sourceType: { notIn: ['DOCUMENT', 'PAYMENT'] },
        },
      },
      select: { id: true, debit: true, credit: true, narration: true, createdAt: true, journalEntry: { select: { date: true, entryNumber: true, narration: true } } },
      orderBy: [{ journalEntry: { date: 'asc' } }, { createdAt: 'asc' }],
    }) : Promise.resolve([]),
  ])

  // 4-5. Map to unified rows + sort
  const allRows = mergeLedgerRows(docs, pays, jeLines)

  // 6. Cursor — skip rows up to and including the cursor position
  let startIdx = 0
  if (cursor) {
    const idx = allRows.findIndex(r => r.id === cursor.lastId && r.source === cursor.lastSource)
    if (idx >= 0) startIdx = idx + 1
  }

  const pageRows = allRows.slice(startIdx, startIdx + limit + 1)
  const hasMore = pageRows.length > limit
  if (hasMore) pageRows.pop()

  // 7. Running balance
  let runningBalance = openingBalance
  // Fast-forward running balance to start of page when using cursor
  if (cursor && startIdx > 0) {
    for (let i = 0; i < startIdx; i++) {
      runningBalance += allRows[i].dr - allRows[i].cr
    }
  }

  const rows: LedgerRow[] = pageRows.map(r => {
    runningBalance += r.dr - r.cr
    return {
      id: r.id, source: r.source,
      date: r.date.toISOString().slice(0, 10),
      voucherType: r.voucherType,
      voucherNumber: r.voucherNumber,
      particulars: r.particulars,
      dr: r.dr, cr: r.cr,
      runningBalance,
      itemCount: r.itemCount,
      mode: r.mode,
    }
  })

  const closingBalance = openingBalance + allRows.reduce((s, r) => s + r.dr - r.cr, 0)

  const nextCursor = hasMore && pageRows.length > 0
    ? encodeCursor({ lastDate: pageRows[pageRows.length - 1].date.toISOString(), lastId: pageRows[pageRows.length - 1].id, lastSource: pageRows[pageRows.length - 1].source })
    : null

  return {
    partyId: party.id,
    partyName: party.name,
    fromDate: query.from,
    toDate: query.to,
    openingBalance,
    closingBalance,
    rows,
    nextCursor,
    hasMore,
    totalCount: allRows.length,
  }
}
