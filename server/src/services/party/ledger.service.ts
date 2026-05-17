/**
 * Party Ledger Service
 *
 * Computes a running-balance ledger for a party over a date window.
 * Three Prisma queries (Document, Payment, JournalEntryLine) are merged in JS
 * and sorted chronologically. Running balance is a single O(n) integer pass.
 *
 * All amounts in PAISE (integer — never float).
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { paymentTypeDirection } from '../../lib/payment-types.js'
import type { PaymentType } from '../../../../shared/enums.js'
import type { LedgerQuery, LedgerRow, LedgerVoucherType } from './ledger.types.js'
import { encodeCursor, decodeCursor } from './ledger.types.js'

// Document types → ledger voucher type + sign (DR positive, CR negative)
const DOC_VOUCHER_MAP: Record<string, { voucherType: LedgerVoucherType; sign: 1 | -1 }> = {
  SALE_INVOICE: { voucherType: 'SALE', sign: 1 },
  POS_SALE:     { voucherType: 'SALE', sign: 1 },
  ESTIMATE:     { voucherType: 'SALE', sign: 1 },
  SALE_ORDER:   { voucherType: 'SALE', sign: 1 },
  DELIVERY_CHALLAN: { voucherType: 'SALE', sign: 1 },
  PURCHASE_INVOICE: { voucherType: 'PURCHASE', sign: -1 },
  CREDIT_NOTE:  { voucherType: 'CN', sign: -1 },
  DEBIT_NOTE:   { voucherType: 'DN', sign: 1 },
}

function startOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`)
}

// Voucher-type filter → document types array
function docTypesForFilter(voucherTypes?: LedgerVoucherType[]): string[] | undefined {
  if (!voucherTypes?.length) return undefined
  const result: string[] = []
  for (const vt of voucherTypes) {
    if (vt === 'SALE') result.push('SALE_INVOICE', 'POS_SALE', 'ESTIMATE', 'SALE_ORDER', 'DELIVERY_CHALLAN')
    if (vt === 'PURCHASE') result.push('PURCHASE_INVOICE')
    if (vt === 'CN') result.push('CREDIT_NOTE')
    if (vt === 'DN') result.push('DEBIT_NOTE')
  }
  return result.length > 0 ? result : undefined
}

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
        journalEntry: { businessId, status: 'POSTED', date: { lt: fromDate } },
      },
      select: { debit: true, credit: true },
    }),
  ])

  let openingBalance = 0
  for (const d of docBefore) {
    const mapping = DOC_VOUCHER_MAP[d.type]
    if (mapping) openingBalance += mapping.sign * Number(d.grandTotal)
  }
  for (const p of payBefore) {
    // paymentTypeDirection mirrors customer-outstanding sign (M6 v2.1); PAYROLL_*=0.
    openingBalance += paymentTypeDirection(p.type as PaymentType) * Number(p.amount)
  }
  for (const j of jeBefore) {
    openingBalance += Number(j.debit) - Number(j.credit)
  }

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
      select: { id: true, type: true, grandTotal: true, documentDate: true, documentNumber: true, createdAt: true, party: { select: { name: true } } },
      orderBy: [{ documentDate: 'asc' }, { createdAt: 'asc' }],
    }) : Promise.resolve([]),

    wantPays ? prisma.payment.findMany({
      where: {
        businessId, partyId,
        date: { gte: fromDate, lte: toDate },
        isDeleted: false,
      },
      select: { id: true, type: true, amount: true, date: true, referenceNumber: true, notes: true, createdAt: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }) : Promise.resolve([]),

    wantJe ? prisma.journalEntryLine.findMany({
      where: {
        partyId,
        journalEntry: { businessId, status: 'POSTED', date: { gte: fromDate, lte: toDate } },
      },
      select: { id: true, debit: true, credit: true, narration: true, createdAt: true, journalEntry: { select: { date: true, entryNumber: true, narration: true } } },
      orderBy: [{ journalEntry: { date: 'asc' } }, { createdAt: 'asc' }],
    }) : Promise.resolve([]),
  ])

  // 4. Map to unified rows
  type RawRow = { id: string; source: 'DOCUMENT' | 'PAYMENT' | 'JOURNAL'; date: Date; createdAt: Date; voucherType: LedgerVoucherType; voucherNumber: string; particulars: string; dr: number; cr: number }

  const allRows: RawRow[] = []

  for (const d of docs) {
    const mapping = DOC_VOUCHER_MAP[d.type]
    if (!mapping) continue
    const amount = Number(d.grandTotal)
    allRows.push({
      id: d.id, source: 'DOCUMENT',
      date: d.documentDate, createdAt: d.createdAt,
      voucherType: mapping.voucherType,
      voucherNumber: d.documentNumber ?? '',
      particulars: `${d.type.replace(/_/g, ' ')} — ${(d as { party: { name: string } }).party.name}`,
      dr: mapping.sign > 0 ? amount : 0,
      cr: mapping.sign < 0 ? amount : 0,
    })
  }

  for (const p of pays) {
    const isIn = p.type === 'PAYMENT_IN'
    allRows.push({
      id: p.id, source: 'PAYMENT',
      date: p.date, createdAt: p.createdAt,
      voucherType: 'PAYMENT',
      voucherNumber: p.referenceNumber ?? '',
      particulars: isIn ? 'Payment received' : 'Payment made',
      dr: isIn ? 0 : Number(p.amount),
      cr: isIn ? Number(p.amount) : 0,
    })
  }

  for (const j of jeLines) {
    allRows.push({
      id: j.id, source: 'JOURNAL',
      date: j.journalEntry.date, createdAt: j.createdAt,
      voucherType: 'JE',
      voucherNumber: j.journalEntry.entryNumber,
      particulars: j.narration ?? j.journalEntry.narration ?? 'Journal Entry',
      dr: Number(j.debit),
      cr: Number(j.credit),
    })
  }

  // 5. Sort merged rows
  allRows.sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime()
    if (d !== 0) return d
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

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
