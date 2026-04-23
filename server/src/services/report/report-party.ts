/**
 * Party Statement — ledger of invoices + payments for a single party.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import type { PartyStatementQuery } from '../../schemas/report.schemas.js'

export async function getPartyStatement(
  businessId: string,
  partyId: string,
  query: PartyStatementQuery,
) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: {
      id: true, name: true, phone: true, type: true,
      outstandingBalance: true,
      openingBalance: { select: { amount: true, type: true, asOfDate: true } },
    },
  })
  if (!party) throw notFoundError('Party')

  const { from, to, limit } = query

  const dateFilter: Record<string, unknown> = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)
  const hasDateFilter = Object.keys(dateFilter).length > 0

  const [invoices, payments] = await Promise.all([
    prisma.document.findMany({
      where: {
        businessId, partyId,
        status: { in: ['SAVED', 'SHARED'] },
        type: { in: ['SALE_INVOICE', 'PURCHASE_INVOICE'] },
        ...(hasDateFilter && { documentDate: dateFilter }),
      },
      select: {
        id: true, type: true, documentNumber: true,
        documentDate: true, grandTotal: true,
      },
      orderBy: { documentDate: 'asc' },
      take: limit,
    }),
    prisma.payment.findMany({
      where: {
        businessId, partyId, isDeleted: false,
        ...(hasDateFilter && { date: dateFilter }),
      },
      select: {
        id: true, type: true, amount: true, date: true, referenceNumber: true,
      },
      orderBy: { date: 'asc' },
      take: limit,
    }),
  ])

  type Txn = {
    id: string; date: Date; type: string; reference: string;
    referenceId: string; description: string; debit: number; credit: number;
  }
  const transactions: Txn[] = []

  for (const inv of invoices) {
    const isSale = inv.type === 'SALE_INVOICE'
    transactions.push({
      id: inv.id,
      date: inv.documentDate,
      type: isSale ? 'sale_invoice' : 'purchase_invoice',
      reference: inv.documentNumber || '',
      referenceId: inv.id,
      description: `${isSale ? 'Sale' : 'Purchase'} Invoice`,
      debit: isSale ? inv.grandTotal : 0,
      credit: isSale ? 0 : inv.grandTotal,
    })
  }

  for (const pmt of payments) {
    const isIn = pmt.type === 'PAYMENT_IN'
    transactions.push({
      id: pmt.id,
      date: pmt.date,
      type: isIn ? 'payment_received' : 'payment_made',
      reference: pmt.referenceNumber || '',
      referenceId: pmt.id,
      description: `Payment ${isIn ? 'Received' : 'Made'}`,
      debit: isIn ? 0 : pmt.amount,
      credit: isIn ? pmt.amount : 0,
    })
  }

  transactions.sort((a, b) => a.date.getTime() - b.date.getTime())

  let balance = party.openingBalance?.amount || 0
  if (party.openingBalance?.type === 'PAYABLE') balance = -balance

  const txnsWithBalance = transactions.map(t => {
    balance += t.debit - t.credit
    return { ...t, date: t.date.toISOString(), runningBalance: balance }
  })

  const totalDebit = transactions.reduce((s, t) => s + t.debit, 0)
  const totalCredit = transactions.reduce((s, t) => s + t.credit, 0)

  return {
    data: {
      party: {
        id: party.id, name: party.name, phone: party.phone,
        type: party.type === 'CUSTOMER' ? 'customer' : 'supplier',
      },
      openingBalance: {
        amount: party.openingBalance?.amount || 0,
        type: (party.openingBalance?.type || 'receivable').toLowerCase(),
        asOfDate: party.openingBalance?.asOfDate?.toISOString() || '',
      },
      closingBalance: {
        amount: Math.abs(balance),
        type: balance >= 0 ? 'receivable' : 'payable',
        asOfDate: new Date().toISOString(),
      },
      transactions: txnsWithBalance,
      totals: { totalDebit, totalCredit },
    },
    meta: { cursor: null, hasMore: false, total: transactions.length },
  }
}
