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
  /** Whole days the oldest still-owing overdue invoice is past due; 0 when none. */
  oldestDueDays: number
  /** Count of non-draft invoices with balance still owing (overdue or not). */
  openInvoiceCount: number
  /**
   * The oldest still-owing overdue invoice — drives the detail page's alert
   * banner ("Oldest invoice is overdue by 12 days"). Null when nothing is
   * overdue, which is also the signal to hide the banner entirely.
   */
  oldestOverdueInvoice: {
    id: string
    number: string
    /** Balance still owing on that invoice (paise), not its grand total. */
    amountPaise: number
    daysOverdue: number
  } | null
}

/** Whole days between two instants, floored at 0. */
function daysBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime()
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000)
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

  // Shared by the three invoice-side reads below — "a saved invoice in this
  // party's direction that still owes money".
  const owingWhere = {
    businessId,
    partyId,
    type: documentType,
    isDeleted: false,
    status: { not: 'DRAFT' },
    balanceDue: { gt: 0 },
  } as const

  const [salesAgg, lastPayment, oldestOverdue, openInvoiceCount] = await Promise.all([
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
    // The single oldest still-owing invoice past its due date. One row, not a
    // count: the detail page's alert banner names it, and `isOverdue` /
    // `oldestDueDays` both fall out of the same row.
    prisma.document.findFirst({
      where: { ...owingWhere, dueDate: { lt: now } },
      orderBy: { dueDate: 'asc' },
      select: { id: true, documentNumber: true, balanceDue: true, dueDate: true },
    }),
    // Everything still owing, overdue or not — the "Open Invoices" tile.
    prisma.document.count({ where: owingWhere }),
  ])

  // dueDate is non-null on every row the filter above can return (`lt: now`
  // excludes nulls), but the column is nullable so narrow rather than assert.
  const oldestDueDays =
    oldestOverdue?.dueDate != null ? daysBetween(oldestOverdue.dueDate, now) : 0

  return {
    salesMtd: salesAgg._sum.grandTotal ?? 0,
    invoiceCountMtd: salesAgg._count,
    lastPayment: lastPayment
      ? { amount: lastPayment.amount, date: lastPayment.date.toISOString(), mode: lastPayment.mode }
      : null,
    isOverdue: oldestOverdue != null,
    oldestDueDays,
    openInvoiceCount,
    oldestOverdueInvoice: oldestOverdue
      ? {
          id: oldestOverdue.id,
          number: oldestOverdue.documentNumber ?? '',
          amountPaise: oldestOverdue.balanceDue,
          daysOverdue: oldestDueDays,
        }
      : null,
  }
}
