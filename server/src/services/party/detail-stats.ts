/**
 * Party detail — summary-tile stats.
 *
 * Derives the three hero-tile subtitles the detail page shows above the tabs:
 *   • Sales (MTD)   — sum + count of this month's sale invoices
 *   • Last payment  — most recent PAYMENT_IN (amount / date / mode)
 *   • Outstanding   — whether any sale invoice is past its due date (Overdue flag)
 *
 * Kept out of list-get.ts so that file stays under the 250-line ratchet and
 * this aggregate concern lives in one place. Amounts are paise (integer).
 */

import { prisma } from '../../lib/prisma.js'

export interface PartyDetailStats {
  /** Sum of this calendar month's sale-invoice grand totals (paise). */
  salesMtd: number
  /** Count of this calendar month's sale invoices. */
  invoiceCountMtd: number
  /** Most recent incoming payment, or null when the party has never paid. */
  lastPayment: { amount: number; date: string; mode: string } | null
  /** True when any non-deleted sale invoice is past its due date with balance owing. */
  isOverdue: boolean
}

/** First instant of the current calendar month (server local time). */
function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export async function getPartyStats(
  businessId: string,
  partyId: string,
): Promise<PartyDetailStats> {
  const now = new Date()
  const monthStart = startOfMonth(now)

  const [salesAgg, lastPayment, overdueCount] = await Promise.all([
    // Sales this month — saved sale invoices only
    prisma.document.aggregate({
      where: {
        businessId,
        partyId,
        type: 'SALE_INVOICE',
        isDeleted: false,
        status: { not: 'DRAFT' },
        documentDate: { gte: monthStart },
      },
      _sum: { grandTotal: true },
      _count: true,
    }),
    // Most recent incoming payment
    prisma.payment.findFirst({
      where: { businessId, partyId, type: 'PAYMENT_IN', isDeleted: false },
      orderBy: { date: 'desc' },
      select: { amount: true, date: true, mode: true },
    }),
    // Any invoice past due with balance still owing
    prisma.document.count({
      where: {
        businessId,
        partyId,
        type: 'SALE_INVOICE',
        isDeleted: false,
        status: { not: 'DRAFT' },
        balanceDue: { gt: 0 },
        dueDate: { lt: now },
      },
    }),
  ])

  return {
    salesMtd: salesAgg._sum.grandTotal ?? 0,
    invoiceCountMtd: salesAgg._count,
    lastPayment: lastPayment
      ? { amount: lastPayment.amount, date: lastPayment.date.toISOString(), mode: lastPayment.mode }
      : null,
    isOverdue: overdueCount > 0,
  }
}
