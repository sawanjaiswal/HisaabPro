/**
 * Statement Service — computes customer account statement data.
 *
 * Opening balance computation is in statement-balance.ts.
 * All amounts in paise (integers). No float arithmetic.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type { StatementDataRes, StatementTransaction } from '../../lib/statement-dtos.js'
import { computeOpeningBalance, DEBIT_DOC_TYPES, ALL_DOC_TYPES } from './statement-balance.js'

// ─── Date validation ──────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDate(s: string): Date {
  if (!ISO_DATE_RE.test(s)) {
    throw new AppError(ErrorCode.INVALID_DATE_FORMAT, 400, 'Date must be YYYY-MM-DD')
  }
  const d = new Date(`${s}T00:00:00.000Z`)
  if (isNaN(d.getTime())) {
    throw new AppError(ErrorCode.INVALID_DATE_FORMAT, 400, 'Date must be YYYY-MM-DD')
  }
  return d
}

function endOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setUTCHours(23, 59, 59, 999)
  return copy
}

function validateDateRange(from: Date, to: Date): void {
  if (from > to) {
    throw new AppError(ErrorCode.INVALID_DATE_RANGE, 400, '"from" must be before or equal to "to"')
  }
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5)
  if (from < fiveYearsAgo) {
    throw new AppError(ErrorCode.INVALID_DATE_RANGE, 400, 'Date range cannot exceed 5 years in the past')
  }
}

// ─── Raw row interface ─────────────────────────────────────────────────────────

interface RawRow {
  date: Date
  type: string
  reference: string
  description: string
  debitPaise: number
  creditPaise: number
  agingDays?: number
}

// ─── Main service ─────────────────────────────────────────────────────────────

export async function getStatementData(
  businessId: string,
  partyId: string,
  fromStr: string,
  toStr: string
): Promise<StatementDataRes> {
  const fromDate = parseDate(fromStr)
  const toDate   = endOfDay(parseDate(toStr))
  validateDateRange(fromDate, toDate)

  // Scope check — 404 if party doesn't belong to this business
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId, isDeleted: false },
    select: {
      id: true, name: true, phone: true, email: true, gstin: true,
      addresses: {
        take: 1,
        where: { isDefault: true, isDeleted: false },
        select: { line1: true, city: true, state: true, pincode: true },
      },
    },
  })
  if (!party) {
    throw new AppError(ErrorCode.PARTY_NOT_FOUND, 404, 'Party not found')
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId },
    select: { name: true, gstin: true, phone: true, logoUrl: true },
  })
  if (!business) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'Business not found')
  }

  const openingBalancePaise = await computeOpeningBalance(businessId, partyId, fromDate)

  // Fetch documents in range
  const docs = await prisma.document.findMany({
    where: {
      businessId, partyId, isDeleted: false,
      type: { in: ALL_DOC_TYPES },
      documentDate: { gte: fromDate, lte: toDate },
    },
    select: {
      id: true, type: true, documentNumber: true,
      documentDate: true, grandTotal: true, notes: true, dueDate: true,
    },
    orderBy: { documentDate: 'asc' },
  })

  // Fetch payments in range
  const payments = await prisma.payment.findMany({
    where: {
      businessId, partyId, isDeleted: false,
      date: { gte: fromDate, lte: toDate },
    },
    select: { id: true, type: true, referenceNumber: true, date: true, amount: true, notes: true },
    orderBy: { date: 'asc' },
  })

  const today = new Date()
  const rawRows: RawRow[] = []

  for (const doc of docs) {
    const isDebit = DEBIT_DOC_TYPES.includes(doc.type)
    const agingMs  = doc.dueDate ? today.getTime() - doc.dueDate.getTime() : null
    const agingDays = agingMs !== null && agingMs > 0 ? Math.floor(agingMs / 86400000) : undefined
    rawRows.push({
      date:       doc.documentDate,
      type:       doc.type,
      reference:  doc.documentNumber ?? doc.id.slice(-8).toUpperCase(),
      description: doc.notes ?? doc.type.replace(/_/g, ' '),
      debitPaise:  isDebit ? doc.grandTotal : 0,
      creditPaise: isDebit ? 0 : doc.grandTotal,
      agingDays,
    })
  }

  for (const p of payments) {
    rawRows.push({
      date:       p.date,
      type:       p.type,
      reference:  p.referenceNumber ?? p.id.slice(-8).toUpperCase(),
      description: p.notes ?? p.type.replace(/_/g, ' '),
      debitPaise:  p.type === 'PAYMENT_OUT' ? p.amount : 0,
      creditPaise: p.type === 'PAYMENT_IN'  ? p.amount : 0,
    })
  }

  // Sort by date ASC
  rawRows.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Running balance fold
  let running = openingBalancePaise
  const transactions: StatementTransaction[] = rawRows.map((row) => {
    running = running + row.debitPaise - row.creditPaise
    return {
      date:        row.date.toISOString().slice(0, 10),
      type:        row.type,
      reference:   row.reference,
      description: row.description,
      debitPaise:  row.debitPaise,
      creditPaise: row.creditPaise,
      balancePaise: running,
      agingDays:   row.agingDays,
    }
  })

  const addr = party.addresses[0]
  const billingAddress = addr
    ? [addr.line1, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
    : null

  logger.info('statement.generated', {
    businessId, partyId, from: fromStr, to: toStr, txnCount: transactions.length,
  })

  return {
    party: { id: party.id, name: party.name, phone: party.phone, email: party.email, gstin: party.gstin, billingAddress },
    business: { name: business.name, gstin: business.gstin, phone: business.phone, logoUrl: business.logoUrl },
    period: { from: fromStr, to: toStr },
    openingBalancePaise,
    transactions,
    closingBalancePaise: running,
    generatedAt: new Date().toISOString(),
  }
}
