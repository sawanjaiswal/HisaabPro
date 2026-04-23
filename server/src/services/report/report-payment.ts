/**
 * Payment History — paginated payment log with grouping and summary.
 */

import { prisma } from '../../lib/prisma.js'
import { groupPayments } from './report-helpers.js'
import type { PaymentHistoryQuery } from '../../schemas/report.schemas.js'

export async function getPaymentHistory(businessId: string, query: PaymentHistoryQuery) {
  const { from, to, partyId, mode, type, groupBy, sortBy, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    isDeleted: false,
  }
  if (from || to) {
    where.date = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    }
  }
  if (partyId) where.partyId = partyId
  if (mode) where.mode = mode.toUpperCase()
  if (type === 'in') where.type = 'PAYMENT_IN'
  if (type === 'out') where.type = 'PAYMENT_OUT'

  const orderField = sortBy.startsWith('amount') ? 'amount' : 'date'
  const orderDir = sortBy.endsWith('asc') ? 'asc' : 'desc'

  const [payments, total, inAgg, outAgg] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true, date: true, type: true, mode: true, amount: true,
        referenceNumber: true, notes: true,
        party: { select: { id: true, name: true } },
        allocations: {
          select: {
            invoice: { select: { id: true, documentNumber: true } },
          },
          take: 1,
        },
      },
      orderBy: { [orderField]: orderDir },
      take: limit + 1,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { ...where, type: 'PAYMENT_IN' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { ...where, type: 'PAYMENT_OUT' },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const hasMore = payments.length > limit
  const resultItems = payments.slice(0, limit)

  const mapped = resultItems.map(p => ({
    id: p.id,
    date: p.date.toISOString(),
    partyId: p.party.id,
    partyName: p.party.name,
    type: p.type === 'PAYMENT_IN' ? 'in' : 'out',
    mode: p.mode,
    amount: p.amount,
    reference: p.referenceNumber || '',
    invoiceId: p.allocations[0]?.invoice?.id || null,
    invoiceNumber: p.allocations[0]?.invoice?.documentNumber || null,
    notes: p.notes || '',
  }))

  return {
    data: {
      summary: {
        totalReceived: inAgg._sum.amount || 0,
        totalPaid: outAgg._sum.amount || 0,
        net: (inAgg._sum.amount || 0) - (outAgg._sum.amount || 0),
        countIn: inAgg._count,
        countOut: outAgg._count,
      },
      items: groupBy === 'none' ? mapped : undefined,
      groups: groupBy !== 'none' ? groupPayments(mapped, groupBy) : undefined,
    },
    meta: {
      cursor: hasMore ? resultItems[resultItems.length - 1].id : null,
      hasMore,
      total,
    },
  }
}
