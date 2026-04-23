/**
 * Invoice Report — sale/purchase invoice report with grouping and summary.
 */

import { prisma } from '../../lib/prisma.js'
import { groupItems } from './report-helpers.js'
import type { InvoiceReportQuery } from '../../schemas/report.schemas.js'

export async function getInvoiceReport(businessId: string, query: InvoiceReportQuery) {
  const { type, from, to, partyId, status, groupBy, sortBy, cursor, limit } = query

  const docType = type === 'sale' ? 'SALE_INVOICE' : 'PURCHASE_INVOICE'

  const where: Record<string, unknown> = {
    businessId,
    type: docType,
    status: { in: ['SAVED', 'SHARED'] },
  }
  if (from || to) {
    where.documentDate = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    }
  }
  if (partyId) where.partyId = partyId
  if (status === 'paid') where.balanceDue = 0
  if (status === 'unpaid') where.paidAmount = 0
  if (status === 'partial') {
    where.paidAmount = { gt: 0 }
    where.balanceDue = { gt: 0 }
  }
  if (cursor) where.id = { lt: cursor }

  const orderField = sortBy.startsWith('amount') ? 'grandTotal' : 'documentDate'
  const orderDir = sortBy.endsWith('asc') ? 'asc' : 'desc'

  const [items, total, summary] = await Promise.all([
    prisma.document.findMany({
      where,
      select: {
        id: true, documentNumber: true, documentDate: true,
        grandTotal: true, paidAmount: true, balanceDue: true,
        party: { select: { id: true, name: true } },
        _count: { select: { lineItems: true } },
      },
      orderBy: { [orderField]: orderDir },
      take: limit + 1,
    }),
    prisma.document.count({ where }),
    prisma.document.aggregate({
      where,
      _count: true,
      _sum: {
        grandTotal: true,
        paidAmount: true,
        balanceDue: true,
        totalDiscount: true,
      },
    }),
  ])

  const hasMore = items.length > limit
  const resultItems = items.slice(0, limit)

  const mapped = resultItems.map(inv => ({
    id: inv.id,
    number: inv.documentNumber,
    date: inv.documentDate.toISOString(),
    partyId: inv.party.id,
    partyName: inv.party.name,
    itemCount: inv._count.lineItems,
    amount: inv.grandTotal,
    paid: inv.paidAmount,
    balance: inv.balanceDue,
    status: inv.balanceDue === 0 ? 'paid' : inv.paidAmount > 0 ? 'partial' : 'unpaid',
  }))

  return {
    data: {
      summary: {
        totalInvoices: summary._count,
        totalAmount: summary._sum.grandTotal || 0,
        totalPaid: summary._sum.paidAmount || 0,
        totalOutstanding: summary._sum.balanceDue || 0,
        totalDiscount: summary._sum.totalDiscount || 0,
      },
      items: groupBy === 'none' ? mapped : undefined,
      groups: groupBy !== 'none' ? groupItems(mapped, groupBy) : undefined,
    },
    meta: {
      cursor: hasMore ? resultItems[resultItems.length - 1].id : null,
      hasMore,
      total,
    },
  }
}
