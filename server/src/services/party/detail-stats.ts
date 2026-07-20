/**
 * Party detail — summary-tile stats.
 *
 * Derives the three hero-tile subtitles the detail page shows above the tabs.
 * The direction follows the party: a customer's tiles read sale invoices and
 * incoming payments, a supplier's read purchase invoices and outgoing ones
 * (mockup #52 — Supplier Ledger). Reading sales for a supplier reported a
 * permanent zero and surfaced the wrong "last payment".
 *
 * Kept out of list-get.ts so that file stays under the 250-line ratchet and
 * this aggregate concern lives in one place. Amounts are paise (integer).
 */

import { prisma } from '../../lib/prisma.js'
import type { PartyType } from '../../../../shared/enums.js'

export interface PartyDetailStats {
  /** This month's invoice total in the party's own direction (paise). */
  salesMtd: number
  /** Count of this calendar month's invoices in that direction. */
  invoiceCountMtd: number
  /** Most recent payment in that direction, or null when there has been none. */
  lastPayment: { amount: number; date: string; mode: string } | null
  /** True when any non-deleted invoice is past its due date with balance owing. */
  isOverdue: boolean
}

/** First instant of the current calendar month (server local time). */
function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export async function getPartyStats(
  businessId: string,
  partyId: string,
  partyType: PartyType = 'CUSTOMER',
): Promise<PartyDetailStats> {
  const now = new Date()
  const monthStart = startOfMonth(now)

  // BOTH parties are read as customers — the sales side is the one they are
  // usually opened for, and mixing both directions into one total would be a
  // number that means nothing.
  const isSupplier = partyType === 'SUPPLIER'
  const documentType = isSupplier ? 'PURCHASE_INVOICE' : 'SALE_INVOICE'
  const paymentType = isSupplier ? 'PAYMENT_OUT' : 'PAYMENT_IN'

  const [salesAgg, lastPayment, overdueCount] = await Promise.all([
    // This month's billing — saved invoices only
    prisma.document.aggregate({
      where: {
        businessId,
        partyId,
        type: documentType,
        isDeleted: false,
        status: { not: 'DRAFT' },
        documentDate: { gte: monthStart },
      },
      _sum: { grandTotal: true },
      _count: true,
    }),
    // Most recent payment in the party's direction
    prisma.payment.findFirst({
      where: { businessId, partyId, type: paymentType, isDeleted: false },
      orderBy: { date: 'desc' },
      select: { amount: true, date: true, mode: true },
    }),
    // Any invoice past due with balance still owing
    prisma.document.count({
      where: {
        businessId,
        partyId,
        type: documentType,
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
