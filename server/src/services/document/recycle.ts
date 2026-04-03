/**
 * Document Service — Recycle bin operations
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { deductForSaleInvoice, addForPurchaseInvoice, scheduleAlertChecks } from '../stock.service.js'
import logger from '../../lib/logger.js'
import { DOCUMENT_LIST_SELECT, DOCUMENT_DETAIL_SELECT } from './selects.js'
import {
  STOCK_DECREASE_TYPES, STOCK_INCREASE_TYPES, AFFECTS_OUTSTANDING,
  updateOutstanding, getOutstandingDelta,
} from './helpers.js'

export async function listRecycleBin(
  businessId: string,
  query: { type?: string; page: number; limit: number }
) {
  const where: Record<string, unknown> = {
    businessId,
    status: 'DELETED',
  }
  if (query.type) where.type = query.type

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      select: {
        ...DOCUMENT_LIST_SELECT,
        deletedAt: true,
        permanentDeleteAt: true,
      },
      orderBy: { deletedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.document.count({ where }),
  ])

  return {
    documents: documents.map(d => ({
      ...d,
      lineItemCount: d._count.lineItems,
      _count: undefined,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  }
}

export async function restoreDocument(businessId: string, documentId: string, userId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: 'DELETED' },
    select: {
      id: true, type: true, partyId: true, grandTotal: true,
      lineItems: { select: { productId: true, quantity: true } },
      documentNumber: true,
    },
  })
  if (!doc) throw notFoundError('Document')

  const result = await prisma.$transaction(async (tx) => {
    // Restore to SAVED status
    await tx.document.update({
      where: { id: documentId },
      data: {
        status: 'SAVED',
        deletedAt: null,
        deletedBy: null,
        permanentDeleteAt: null,
        updatedBy: userId,
      },
    })

    // Re-apply stock effects
    if (STOCK_DECREASE_TYPES.has(doc.type)) {
      await deductForSaleInvoice(tx, {
        businessId,
        invoiceId: documentId,
        invoiceNumber: doc.documentNumber || '',
        items: doc.lineItems.map(li => ({
          productId: li.productId,
          quantity: li.quantity,
          unitId: li.productId,
        })),
        userId,
      })
    } else if (STOCK_INCREASE_TYPES.has(doc.type)) {
      await addForPurchaseInvoice(tx, {
        businessId,
        invoiceId: documentId,
        invoiceNumber: doc.documentNumber || '',
        items: doc.lineItems.map(li => ({
          productId: li.productId,
          quantity: li.quantity,
          unitId: li.productId,
        })),
        userId,
      })
    }

    // Re-apply outstanding
    if (AFFECTS_OUTSTANDING.has(doc.type)) {
      const outstandingDelta = getOutstandingDelta(doc.type, doc.grandTotal)
      await updateOutstanding(tx, doc.partyId, outstandingDelta)
    }

    return tx.document.findUniqueOrThrow({
      where: { id: documentId },
      select: DOCUMENT_DETAIL_SELECT,
    })
  })

  // Post-transaction: fire stock alert checks for restored document
  if (STOCK_DECREASE_TYPES.has(doc.type) || STOCK_INCREASE_TYPES.has(doc.type)) {
    const productIds = doc.lineItems.map(li => li.productId)
    scheduleAlertChecks(businessId, productIds)
  }

  return result
}

export async function permanentDeleteDocument(businessId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: 'DELETED' },
    select: { id: true },
  })
  if (!doc) throw notFoundError('Document')

  await prisma.document.delete({ where: { id: documentId } })
}

export async function emptyRecycleBin(businessId: string) {
  const result = await prisma.document.deleteMany({
    where: { businessId, status: 'DELETED' },
  })
  return { deletedCount: result.count }
}

/** Cleanup expired recycle bin items — for cron job */
export async function cleanupExpiredDocuments() {
  const result = await prisma.document.deleteMany({
    where: {
      status: 'DELETED',
      permanentDeleteAt: { lte: new Date() },
    },
  })
  logger.info('Recycle bin cleanup', { deleted: result.count })
  return result.count
}
