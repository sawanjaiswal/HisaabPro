/**
 * Document Service — deleteDocument
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { reverseForInvoice, scheduleAlertChecks } from '../stock.service.js'
import { assertStockGiveBackPossible, giveBackForDocument } from '../stock/reversal-guard.js'
import {
  STOCK_DECREASE_TYPES, STOCK_INCREASE_TYPES, AFFECTS_OUTSTANDING,
  updateOutstanding, getOutstandingReverseDelta,
} from './helpers.js'
import { reverseSourceEntry } from '../accounting/posting/index.js'
import { createAuditEntry } from '../settings/audit.js'

export async function deleteDocument(businessId: string, documentId: string, userId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, status: { not: 'DELETED' } },
    select: {
      id: true, type: true, status: true, partyId: true, grandTotal: true,
      documentNumber: true,
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
        // Deleting a received-goods document un-receives the stock. If it has
        // already been sold on, that is not possible — refuse rather than let
        // the shelf go negative with no trace of why. See reversal-guard.ts.
        if (STOCK_INCREASE_TYPES.has(doc.type)) {
          await assertStockGiveBackPossible(tx, {
            businessId,
            needed: await giveBackForDocument(tx, { businessId, documentId }),
          })
        }
        await reverseForInvoice(tx, { businessId, invoiceId: documentId, userId })
      }
      if (AFFECTS_OUTSTANDING.has(doc.type)) {
        const reverseDelta = getOutstandingReverseDelta(doc.type, doc.grandTotal)
        await updateOutstanding(tx, doc.partyId, reverseDelta)
      }
      // S1 — GL: VOID the source's posted journal entry (reverses balances).
      await reverseSourceEntry(tx, businessId, 'DOCUMENT', documentId, 'Document deleted')
    }

    const updated = await tx.document.update({
      where: { id: documentId },
      data: {
        // `isDeleted` is the fact — Document is in SOFT_DELETE_MODELS, so every
        // reader that does not carry its own status predicate (ledger, public
        // invoice view, share links, quota counts) hides the row off this flag
        // alone. `status` is the recycle-bin state that rides along with it.
        isDeleted: true,
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId,
        permanentDeleteAt,
      },
      select: { id: true, status: true, deletedAt: true, permanentDeleteAt: true },
    })

    await createAuditEntry({
      businessId,
      entityType: 'Document',
      entityId: documentId,
      entityLabel: doc.documentNumber?.slice(0, 120) ?? null,
      userId,
      action: 'DELETE',
      changes: { type: doc.type, prevStatus: doc.status, softDeleted: true },
    }, tx)

    return updated
  })

  // Post-transaction: fire stock alert checks (stock reversed = may resolve alerts)
  if (wasSaved && (STOCK_DECREASE_TYPES.has(doc.type) || STOCK_INCREASE_TYPES.has(doc.type))) {
    const productIds = doc.lineItems.map(li => li.productId)
    scheduleAlertChecks(businessId, productIds)
  }

  return result
}
