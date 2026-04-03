/**
 * Document Service — deleteDocument
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { reverseForInvoice, scheduleAlertChecks } from '../stock.service.js'
import {
  STOCK_DECREASE_TYPES, STOCK_INCREASE_TYPES, AFFECTS_OUTSTANDING,
  updateOutstanding, getOutstandingReverseDelta,
} from './helpers.js'

export async function deleteDocument(businessId: string, documentId: string, userId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: { not: 'DELETED' } },
    select: {
      id: true, type: true, status: true, partyId: true, grandTotal: true,
      lineItems: { select: { productId: true, quantity: true } },
    },
  })
  if (!doc) throw notFoundError('Document')
  if (doc.status === 'CONVERTED') throw validationError('Cannot delete a converted document')

  const wasSaved = doc.status === 'SAVED' || doc.status === 'SHARED'

  // Get retention days
  const settings = await prisma.documentSettings.findUnique({
    where: { businessId },
    select: { recycleBinRetentionDays: true },
  })
  const retentionDays = settings?.recycleBinRetentionDays || 30
  const permanentDeleteAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)

  const result = await prisma.$transaction(async (tx) => {
    // Reverse side effects
    if (wasSaved) {
      if (STOCK_DECREASE_TYPES.has(doc.type) || STOCK_INCREASE_TYPES.has(doc.type)) {
        await reverseForInvoice(tx, { businessId, invoiceId: documentId, userId })
      }
      if (AFFECTS_OUTSTANDING.has(doc.type)) {
        const reverseDelta = getOutstandingReverseDelta(doc.type, doc.grandTotal)
        await updateOutstanding(tx, doc.partyId, reverseDelta)
      }
    }

    const updated = await tx.document.update({
      where: { id: documentId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId,
        permanentDeleteAt,
      },
      select: { id: true, status: true, deletedAt: true, permanentDeleteAt: true },
    })

    return updated
  })

  // Post-transaction: fire stock alert checks (stock reversed = may resolve alerts)
  if (wasSaved && (STOCK_DECREASE_TYPES.has(doc.type) || STOCK_INCREASE_TYPES.has(doc.type))) {
    const productIds = doc.lineItems.map(li => li.productId)
    scheduleAlertChecks(businessId, productIds)
  }

  return result
}
