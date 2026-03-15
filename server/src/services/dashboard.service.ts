/**
 * Dashboard Service — aggregated stats for the dashboard page
 * All amounts in PAISE. Uses DB aggregates, never findMany().reduce().
 */

import { prisma } from '../lib/prisma.js'
import type { DashboardStatsQuery } from '../schemas/report.schemas.js'

/** Resolve date range from preset */
function resolveDateRange(query: DashboardStatsQuery): { from: Date; to: Date; label: string } {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

  switch (query.range) {
    case 'this_week': {
      const dayOfWeek = now.getDay()
      const monday = new Date(todayStart)
      monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      return { from: monday, to: todayEnd, label: 'This Week' }
    }
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: monthStart, to: todayEnd, label: 'This Month' }
    }
    case 'custom': {
      if (!query.from || !query.to) {
        return { from: todayStart, to: todayEnd, label: 'Today' }
      }
      return {
        from: new Date(query.from),
        to: new Date(query.to + 'T23:59:59.999Z'),
        label: 'Custom',
      }
    }
    default: // 'today'
      return { from: todayStart, to: todayEnd, label: 'Today' }
  }
}

export async function getDashboardStats(businessId: string, query: DashboardStatsQuery) {
  const { from, to, label } = resolveDateRange(query)

  const dateFilter = { gte: from, lte: to }

  // Run all queries in parallel
  const [
    salesAgg,
    purchasesAgg,
    receivableAgg,
    payableAgg,
    paymentsInAgg,
    paymentsOutAgg,
    topCustomers,
  ] = await Promise.all([
    // Sales count + total
    prisma.document.aggregate({
      where: {
        businessId,
        type: 'SALE_INVOICE',
        status: { in: ['SAVED', 'SHARED'] },
        documentDate: dateFilter,
      },
      _count: true,
      _sum: { grandTotal: true },
    }),

    // Purchases count + total
    prisma.document.aggregate({
      where: {
        businessId,
        type: 'PURCHASE_INVOICE',
        status: { in: ['SAVED', 'SHARED'] },
        documentDate: dateFilter,
      },
      _count: true,
      _sum: { grandTotal: true },
    }),

    // Receivable (parties with positive outstanding)
    prisma.party.aggregate({
      where: { businessId, isActive: true, outstandingBalance: { gt: 0 } },
      _sum: { outstandingBalance: true },
      _count: true,
    }),

    // Payable (parties with negative outstanding)
    prisma.party.aggregate({
      where: { businessId, isActive: true, outstandingBalance: { lt: 0 } },
      _sum: { outstandingBalance: true },
      _count: true,
    }),

    // Payments received in range
    prisma.payment.aggregate({
      where: {
        businessId, type: 'PAYMENT_IN', isDeleted: false, date: dateFilter,
      },
      _sum: { amount: true },
    }),

    // Payments made in range
    prisma.payment.aggregate({
      where: {
        businessId, type: 'PAYMENT_OUT', isDeleted: false, date: dateFilter,
      },
      _sum: { amount: true },
    }),

    // Top 5 outstanding customers
    prisma.party.findMany({
      where: {
        businessId, isActive: true, outstandingBalance: { gt: 0 },
      },
      select: {
        id: true, name: true, phone: true, outstandingBalance: true,
      },
      orderBy: { outstandingBalance: 'desc' },
      take: 5,
    }),
  ])

  const paymentsReceived = paymentsInAgg._sum.amount || 0
  const paymentsMade = paymentsOutAgg._sum.amount || 0

  return {
    range: {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
      label,
    },
    sales: {
      count: salesAgg._count,
      amount: salesAgg._sum.grandTotal || 0,
    },
    purchases: {
      count: purchasesAgg._count,
      amount: purchasesAgg._sum.grandTotal || 0,
    },
    receivable: {
      total: receivableAgg._sum.outstandingBalance || 0,
      partyCount: receivableAgg._count,
    },
    payable: {
      total: Math.abs(payableAgg._sum.outstandingBalance || 0),
      partyCount: payableAgg._count,
    },
    topOutstandingCustomers: topCustomers.map(c => ({
      partyId: c.id,
      name: c.name,
      phone: c.phone,
      outstanding: c.outstandingBalance,
      oldestDueDate: '', // simplified for MVP
      daysOverdue: 0,
    })),
    paymentsReceived,
    paymentsMade,
    netCashFlow: paymentsReceived - paymentsMade,
  }
}
