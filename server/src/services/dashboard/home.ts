/**
 * Dashboard Home — single-call aggregated stats for the home screen.
 * All amounts in PAISE. Uses DB aggregates, never findMany().reduce().
 */

import { prisma } from '../../lib/prisma.js'

const RECENT_ACTIVITY_LIMIT = 10
const TOP_DEBTORS_LIMIT = 5

export async function getHomeDashboard(businessId: string) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)
  const todayFilter = { gte: todayStart, lte: todayEnd }

  const [
    receivableAgg,
    payableAgg,
    todaySalesAgg,
    todayPaymentsInAgg,
    todayPaymentsOutAgg,
    recentInvoices,
    recentPayments,
    lowStockCount,
    overdueInvoiceAgg,
    topDebtors,
  ] = await Promise.all([
    // Outstanding receivable
    prisma.party.aggregate({
      where: { businessId, isActive: true, outstandingBalance: { gt: 0 } },
      _sum: { outstandingBalance: true },
      _count: true,
    }),

    // Outstanding payable
    prisma.party.aggregate({
      where: { businessId, isActive: true, outstandingBalance: { lt: 0 } },
      _sum: { outstandingBalance: true },
      _count: true,
    }),

    // Today's sales
    prisma.document.aggregate({
      where: {
        businessId,
        type: 'SALE_INVOICE',
        status: { in: ['SAVED', 'SHARED'] },
        documentDate: todayFilter,
      },
      _count: true,
      _sum: { grandTotal: true },
    }),

    // Today's payments received
    prisma.payment.aggregate({
      where: { businessId, type: 'PAYMENT_IN', isDeleted: false, date: todayFilter },
      _sum: { amount: true },
      _count: true,
    }),

    // Today's payments made
    prisma.payment.aggregate({
      where: { businessId, type: 'PAYMENT_OUT', isDeleted: false, date: todayFilter },
      _sum: { amount: true },
    }),

    // Recent invoices (last 10)
    prisma.document.findMany({
      where: {
        businessId,
        type: { in: ['SALE_INVOICE', 'PURCHASE_INVOICE'] },
        status: { in: ['SAVED', 'SHARED'] },
        deletedAt: null,
      },
      select: {
        id: true,
        type: true,
        partyId: true,
        documentNumber: true,
        grandTotal: true,
        balanceDue: true,
        documentDate: true,
        party: { select: { name: true } },
      },
      orderBy: { documentDate: 'desc' },
      take: RECENT_ACTIVITY_LIMIT,
    }),

    // Recent payments (last 10)
    prisma.payment.findMany({
      where: { businessId, isDeleted: false },
      select: {
        id: true,
        type: true,
        partyId: true,
        amount: true,
        mode: true,
        date: true,
        party: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: RECENT_ACTIVITY_LIMIT,
    }),

    // Low stock count (field-to-field comparison requires raw SQL)
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "Product"
      WHERE "businessId" = ${businessId}
        AND "status" = 'ACTIVE'
        AND "minStockLevel" > 0
        AND "currentStock" <= "minStockLevel"
    `.then(rows => Number(rows[0]?.count ?? 0)),

    // Overdue invoices (past due date, still has balance)
    prisma.document.aggregate({
      where: {
        businessId,
        type: 'SALE_INVOICE',
        status: { in: ['SAVED', 'SHARED'] },
        deletedAt: null,
        balanceDue: { gt: 0 },
        dueDate: { lt: todayStart },
      },
      _count: true,
      _sum: { balanceDue: true },
    }),

    // Top debtors
    prisma.party.findMany({
      where: { businessId, isActive: true, outstandingBalance: { gt: 0 } },
      select: {
        id: true, name: true, phone: true, outstandingBalance: true,
        documents: {
          where: { status: { in: ['SAVED', 'SHARED'] }, balanceDue: { gt: 0 }, deletedAt: null },
          select: { dueDate: true, documentDate: true },
          orderBy: { documentDate: 'asc' },
          take: 1,
        },
      },
      orderBy: { outstandingBalance: 'desc' },
      take: TOP_DEBTORS_LIMIT,
    }),
  ])

  const invoiceActivities = recentInvoices.map(inv => {
    const isPaid = inv.balanceDue === 0
    const isPartial = inv.balanceDue > 0 && inv.balanceDue < inv.grandTotal
    return {
      id: inv.id,
      type: inv.type === 'SALE_INVOICE' ? 'sale_invoice' as const : 'purchase_invoice' as const,
      partyId: inv.partyId,
      partyName: inv.party.name,
      amount: inv.grandTotal,
      date: inv.documentDate.toISOString(),
      reference: inv.documentNumber ?? '',
      status: isPaid ? 'paid' as const : isPartial ? 'partial' as const : 'unpaid' as const,
    }
  })

  const paymentActivities = recentPayments.map(pmt => ({
    id: pmt.id,
    type: pmt.type === 'PAYMENT_IN' ? 'payment_in' as const : 'payment_out' as const,
    partyId: pmt.partyId,
    partyName: pmt.party.name,
    amount: pmt.amount,
    date: pmt.date.toISOString(),
    reference: 'Payment',
    mode: pmt.mode,
  }))

  const recentActivity = [...invoiceActivities, ...paymentActivities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, RECENT_ACTIVITY_LIMIT)

  const paymentsReceivedAmount = todayPaymentsInAgg._sum.amount || 0
  const paymentsMadeAmount = todayPaymentsOutAgg._sum.amount || 0

  return {
    outstanding: {
      receivable: {
        total: receivableAgg._sum.outstandingBalance || 0,
        partyCount: receivableAgg._count,
      },
      payable: {
        total: Math.abs(payableAgg._sum.outstandingBalance || 0),
        partyCount: payableAgg._count,
      },
    },
    today: {
      salesCount: todaySalesAgg._count,
      salesAmount: todaySalesAgg._sum.grandTotal || 0,
      paymentsReceivedCount: todayPaymentsInAgg._count,
      paymentsReceivedAmount,
      paymentsMadeAmount,
      netCashFlow: paymentsReceivedAmount - paymentsMadeAmount,
    },
    recentActivity,
    alerts: {
      lowStockCount: typeof lowStockCount === 'number' ? lowStockCount : 0,
      overdueInvoiceCount: overdueInvoiceAgg._count,
      overdueAmount: overdueInvoiceAgg._sum.balanceDue || 0,
    },
    topDebtors: topDebtors.map(c => {
      const oldestInv = c.documents[0]
      const dueDate = oldestInv?.dueDate ?? oldestInv?.documentDate ?? null
      const dueDateStr = dueDate instanceof Date ? dueDate.toISOString().split('T')[0] : (dueDate ?? '')
      const daysOverdue = dueDate
        ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000))
        : 0
      return {
        partyId: c.id,
        name: c.name,
        phone: c.phone ?? '',
        outstanding: c.outstandingBalance,
        oldestDueDate: dueDateStr,
        daysOverdue,
      }
    }),
  }
}
