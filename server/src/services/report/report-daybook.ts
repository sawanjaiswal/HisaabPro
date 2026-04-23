/**
 * Day Book — all transactions (sales, purchases, payments) for a single day.
 */

import { prisma } from '../../lib/prisma.js'
import { formatTime } from './report-helpers.js'
import type { DayBookQuery } from '../../schemas/report.schemas.js'

export async function getDayBook(businessId: string, query: DayBookQuery) {
  const { date, type, limit } = query

  const dayStart = new Date(date)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1)
  const dateFilter = { gte: dayStart, lte: dayEnd }

  const [sales, purchases, paymentsIn, paymentsOut] = await Promise.all([
    (!type || type === 'sale') ? prisma.document.findMany({
      where: {
        businessId, type: 'SALE_INVOICE', status: { in: ['SAVED', 'SHARED'] },
        documentDate: dateFilter,
      },
      select: {
        id: true, documentNumber: true, grandTotal: true, documentDate: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) : [],

    (!type || type === 'purchase') ? prisma.document.findMany({
      where: {
        businessId, type: 'PURCHASE_INVOICE', status: { in: ['SAVED', 'SHARED'] },
        documentDate: dateFilter,
      },
      select: {
        id: true, documentNumber: true, grandTotal: true, documentDate: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) : [],

    (!type || type === 'payment_in') ? prisma.payment.findMany({
      where: { businessId, type: 'PAYMENT_IN', isDeleted: false, date: dateFilter },
      select: {
        id: true, amount: true, date: true, mode: true, referenceNumber: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) : [],

    (!type || type === 'payment_out') ? prisma.payment.findMany({
      where: { businessId, type: 'PAYMENT_OUT', isDeleted: false, date: dateFilter },
      select: {
        id: true, amount: true, date: true, mode: true, referenceNumber: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) : [],
  ])

  type DayBookTxn = {
    id: string; time: string; type: string; description: string;
    reference: string; referenceId: string; partyName: string;
    amount: number; mode?: string;
  }

  const transactions: DayBookTxn[] = []

  for (const s of sales) {
    transactions.push({
      id: s.id, time: formatTime(s.documentDate), type: 'sale',
      description: 'Sale Invoice', reference: s.documentNumber || '',
      referenceId: s.id, partyName: s.party.name, amount: s.grandTotal,
    })
  }
  for (const p of purchases) {
    transactions.push({
      id: p.id, time: formatTime(p.documentDate), type: 'purchase',
      description: 'Purchase Invoice', reference: p.documentNumber || '',
      referenceId: p.id, partyName: p.party.name, amount: p.grandTotal,
    })
  }
  for (const pi of paymentsIn) {
    transactions.push({
      id: pi.id, time: formatTime(pi.date), type: 'payment_in',
      description: 'Payment Received', reference: pi.referenceNumber || '',
      referenceId: pi.id, partyName: pi.party.name, amount: pi.amount, mode: pi.mode,
    })
  }
  for (const po of paymentsOut) {
    transactions.push({
      id: po.id, time: formatTime(po.date), type: 'payment_out',
      description: 'Payment Made', reference: po.referenceNumber || '',
      referenceId: po.id, partyName: po.party.name, amount: po.amount, mode: po.mode,
    })
  }

  const salesTotal = sales.reduce((s, i) => s + i.grandTotal, 0)
  const purchasesTotal = purchases.reduce((s, i) => s + i.grandTotal, 0)
  const paymentsInTotal = paymentsIn.reduce((s, i) => s + i.amount, 0)
  const paymentsOutTotal = paymentsOut.reduce((s, i) => s + i.amount, 0)

  const prevDate = new Date(dayStart)
  prevDate.setDate(prevDate.getDate() - 1)
  const nextDate = new Date(dayStart)
  nextDate.setDate(nextDate.getDate() + 1)

  return {
    data: {
      date,
      dayLabel: dayStart.toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
      summary: {
        totalSales: { count: sales.length, amount: salesTotal },
        totalPurchases: { count: purchases.length, amount: purchasesTotal },
        paymentsIn: { count: paymentsIn.length, amount: paymentsInTotal },
        paymentsOut: { count: paymentsOut.length, amount: paymentsOutTotal },
        expenses: { count: 0, amount: 0 },
        stockAdjustments: { count: 0, amount: 0 },
        netCashFlow: paymentsInTotal - paymentsOutTotal,
      },
      transactions,
      navigation: {
        prevDate: prevDate.toISOString().split('T')[0],
        nextDate: nextDate <= new Date() ? nextDate.toISOString().split('T')[0] : null,
      },
    },
    meta: { cursor: null, hasMore: false, total: transactions.length },
  }
}
