/**
 * Document Service — getDocument + listDocuments
 */

import { prisma } from '../../lib/prisma.js'
import type { ListDocumentsQuery } from '../../schemas/document.schemas.js'
import { DOCUMENT_LIST_SELECT, DOCUMENT_DETAIL_SELECT } from './selects.js'
import { requireDocument } from './helpers.js'

export async function getDocument(businessId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: { not: 'DELETED' } },
    select: DOCUMENT_DETAIL_SELECT,
  })
  return requireDocument(doc)
}

export async function listDocuments(businessId: string, query: ListDocumentsQuery) {
  const { type, status, partyId, fromDate, toDate, search, sortBy, sortOrder, page, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    type,
    status: status
      ? { in: status.split(',').map(s => s.trim()) }
      : { in: ['SAVED', 'SHARED'] },
  }
  if (partyId) where.partyId = partyId
  if (fromDate || toDate) {
    where.documentDate = {
      ...(fromDate && { gte: new Date(fromDate) }),
      ...(toDate && { lte: new Date(toDate) }),
    }
  }
  if (search) {
    where.OR = [
      { documentNumber: { contains: search, mode: 'insensitive' } },
      { party: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [documents, total, aggregates] = await Promise.all([
    prisma.document.findMany({
      where,
      select: DOCUMENT_LIST_SELECT,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.document.count({ where }),
    prisma.document.aggregate({
      where,
      _sum: { grandTotal: true, paidAmount: true, balanceDue: true },
    }),
  ])

  return {
    documents: documents.map(d => ({
      ...d,
      lineItemCount: d._count.lineItems,
      _count: undefined,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalAmount: aggregates._sum.grandTotal || 0,
      totalPaid: aggregates._sum.paidAmount || 0,
      totalDue: aggregates._sum.balanceDue || 0,
    },
  }
}
