/**
 * Payment retrieval — get single + list with filters
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { PAYMENT_LIST_SELECT, PAYMENT_DETAIL_SELECT } from './selects.js'
import type { ListPaymentsQuery } from '../../schemas/payment.schemas.js'

export async function getPayment(businessId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: PAYMENT_DETAIL_SELECT,
  })
  if (!payment) throw notFoundError('Payment')

  return {
    id: payment.id,
    offlineId: payment.offlineId,
    type: payment.type,
    amount: payment.amount,
    date: payment.date instanceof Date ? payment.date.toISOString().slice(0, 10) : payment.date,
    mode: payment.mode,
    referenceNumber: payment.referenceNumber,
    notes: payment.notes,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    partyId: payment.party.id,
    partyName: payment.party.name,
    partyPhone: payment.party.phone,
    partyOutstanding: payment.party.outstandingBalance,
    allocations: payment.allocations.map(a => ({
      id: a.id,
      invoiceId: a.invoice.id,
      invoiceNumber: a.invoice.documentNumber,
      invoiceTotal: a.invoice.grandTotal,
      invoiceDue: a.invoice.balanceDue,
      amount: a.amount,
    })),
    discount: payment.discount,
    createdBy: payment.creator ? { id: payment.creator.id, name: payment.creator.name } : null,
  }
}

export async function listPayments(businessId: string, query: ListPaymentsQuery) {
  const { type, partyId, mode, dateFrom, dateTo, search, sortBy, sortOrder, page, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    isDeleted: false,
  }
  if (type) where.type = type
  if (partyId) where.partyId = partyId
  if (mode) where.mode = mode
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    }
  }
  if (search) {
    where.OR = [
      { referenceNumber: { contains: search, mode: 'insensitive' } },
      { party: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const orderByField = sortBy === 'amount' ? 'amount' : sortBy === 'createdAt' ? 'createdAt' : 'date'

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: PAYMENT_LIST_SELECT,
      orderBy: { [orderByField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ])

  // Single groupBy replaces two separate aggregate calls
  const typeAgg = await prisma.payment.groupBy({
    by: ['type'],
    where,
    _sum: { amount: true },
  })
  const totalIn = typeAgg.find(t => t.type === 'PAYMENT_IN')?._sum.amount || 0
  const totalOut = typeAgg.find(t => t.type === 'PAYMENT_OUT')?._sum.amount || 0

  return {
    payments: payments.map(p => ({
      id: p.id,
      type: p.type,
      amount: p.amount,
      date: p.date instanceof Date ? p.date.toISOString().slice(0, 10) : p.date,
      mode: p.mode,
      referenceNumber: p.referenceNumber,
      notes: p.notes,
      createdAt: p.createdAt,
      partyId: p.party.id,
      partyName: p.party.name,
      partyPhone: p.party.phone,
      allocationsCount: p._count.allocations,
      hasDiscount: !!p.discount,
      discountAmount: p.discount?.calculatedAmount || 0,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
    },
  }
}
