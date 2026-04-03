/**
 * Outstanding balance queries — party list + party detail
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import type { ListOutstandingQuery } from '../../schemas/payment.schemas.js'

export async function listOutstanding(businessId: string, query: ListOutstandingQuery) {
  const { type, overdue: _overdue, search, sortBy, sortOrder, page, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    isActive: true,
    outstandingBalance: { not: 0 },
  }

  if (type === 'RECEIVABLE') where.outstandingBalance = { gt: 0 }
  if (type === 'PAYABLE') where.outstandingBalance = { lt: 0 }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ]
  }

  const orderByField = sortBy === 'amount' ? 'outstandingBalance'
    : sortBy === 'name' ? 'name'
    : 'lastTransactionAt'

  const [parties, total] = await Promise.all([
    prisma.party.findMany({
      where,
      select: {
        id: true, name: true, phone: true, type: true,
        outstandingBalance: true,
        lastTransactionAt: true,
        _count: {
          select: {
            documents: {
              where: { status: { in: ['SAVED', 'SHARED'] }, balanceDue: { gt: 0 } },
            },
          },
        },
      },
      orderBy: { [orderByField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.party.count({ where }),
  ])

  // Aggregate totals
  const [receivable, payable] = await Promise.all([
    prisma.party.aggregate({
      where: { businessId, isActive: true, outstandingBalance: { gt: 0 } },
      _sum: { outstandingBalance: true },
    }),
    prisma.party.aggregate({
      where: { businessId, isActive: true, outstandingBalance: { lt: 0 } },
      _sum: { outstandingBalance: true },
    }),
  ])

  const totalReceivable = receivable._sum.outstandingBalance || 0
  const totalPayable = Math.abs(payable._sum.outstandingBalance || 0)

  return {
    parties: parties.map(p => ({
      partyId: p.id,
      partyName: p.name,
      partyPhone: p.phone,
      partyType: p.type,
      outstanding: Math.abs(p.outstandingBalance),
      type: p.outstandingBalance > 0 ? 'RECEIVABLE' : 'PAYABLE',
      invoiceCount: p._count.documents,
      lastPaymentDate: p.lastTransactionAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    totals: {
      totalReceivable,
      totalPayable,
      net: totalReceivable - totalPayable,
    },
  }
}

export async function getPartyOutstanding(
  businessId: string,
  partyId: string,
  cursor?: string,
  limit = 20
) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: {
      id: true, name: true, phone: true, outstandingBalance: true,
    },
  })
  if (!party) throw notFoundError('Party')

  // Get outstanding invoices with cursor-based pagination
  const invoices = await prisma.document.findMany({
    where: {
      businessId,
      partyId,
      status: { in: ['SAVED', 'SHARED'] },
      balanceDue: { not: 0 },
    },
    select: {
      id: true, documentNumber: true, documentDate: true,
      dueDate: true, grandTotal: true, paidAmount: true, balanceDue: true, type: true,
    },
    orderBy: { documentDate: 'desc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  })

  const hasMore = invoices.length > limit
  const page = hasMore ? invoices.slice(0, limit) : invoices
  const nextCursor = hasMore ? page[page.length - 1]?.id : undefined

  return {
    partyId: party.id,
    partyName: party.name,
    outstanding: Math.abs(party.outstandingBalance),
    invoices: page.map(inv => ({
      id: inv.id,
      number: inv.documentNumber,
      date: inv.documentDate,
      dueDate: inv.dueDate,
      total: inv.grandTotal,
      paid: inv.paidAmount,
      due: inv.balanceDue,
      daysOverdue: inv.dueDate
        ? Math.max(0, Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0,
    })),
    pagination: { hasMore, nextCursor },
  }
}
