/** Document Service — updateDocument */
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { deductForSaleInvoice, addForPurchaseInvoice, reverseForInvoice, scheduleAlertChecks } from '../stock.service.js'
import { assertStockGiveBackPossible, giveBackForDocument } from '../stock/reversal-guard.js'
import { generateNextNumber } from '../document-number.service.js'
import type { UpdateDocumentInput } from '../../schemas/document.schemas.js'
import { DOCUMENT_DETAIL_SELECT } from './selects.js'
import {
  STOCK_DECREASE_TYPES, STOCK_INCREASE_TYPES, AFFECTS_OUTSTANDING,
  updateOutstanding, getOutstandingDelta, getOutstandingReverseDelta, stockMovementLabels,
} from './helpers.js'
import { type MoqViolation } from './moq.guard.js'
import { persistDocumentCustomFieldValues } from './custom-fields.js'
import { recomputeLineItemsAndTotals } from './update-recompute.js'
import { accrueForSaleInvoice, emitDocumentCommissionAnalytics, type DocumentCommissionOutcome } from './document-commission.js'
import { bumpVersionOrConflict } from '../../lib/optimistic-lock.js'
import { postDocument, reverseSourceEntry } from '../accounting/posting/index.js'
import { POSTING_DOC_SELECT } from '../accounting/posting/post-document.js'
import { createAuditEntry } from '../settings/audit.js'

export async function updateDocument(
  businessId: string,
  documentId: string,
  userId: string,
  data: UpdateDocumentInput,
  expectedVersion?: number
) {
  let moqWarnings: MoqViolation[] = []
  let commissionOutcome: DocumentCommissionOutcome | null = null // Epic D PR5 §3.8
  const existing = await prisma.document.findFirst({
    where: { id: documentId, businessId },
    select: {
      id: true, type: true, status: true, partyId: true, grandTotal: true,
      placeOfSupply: true, isComposite: true, taxPricingMode: true, isReverseCharge: true,
      lineItems: { select: { productId: true, quantity: true } },
    },
  })
  if (!existing) throw notFoundError('Document')
  if (existing.status === 'CONVERTED') throw validationError('Cannot edit a converted document')
  if (existing.status === 'DELETED') throw validationError('Cannot edit a deleted document')

  // Security 2.1: verify priceListId belongs to this business (cross-tenant guard)
  if (data.priceListId) {
    const ownedList = await prisma.priceList.findFirst({ where: { id: data.priceListId, businessId, isDeleted: false }, select: { id: true } })
    if (!ownedList) throw notFoundError('Price list')
  }

  const wasSaved = existing.status === 'SAVED' || existing.status === 'SHARED'
  const willBeSaved = data.status === 'SAVED' || (wasSaved && !data.status)
  const result = await prisma.$transaction(async (tx) => {
    // #150 optimistic lock — take the version-guarded row lock before any
    // stock reversal / recompute, so a concurrent writer 409s deterministically.
    await bumpVersionOrConflict(tx, 'document', documentId, businessId, expectedVersion)
    if (wasSaved && (STOCK_DECREASE_TYPES.has(existing.type) || STOCK_INCREASE_TYPES.has(existing.type))) {
      // Shrinking (or un-saving) a received-goods document takes stock back off
      // the shelf. Only the NET matters here: the edit reverses the old lines
      // and re-applies the new ones in the same transaction, so an unchanged
      // quantity gives nothing back. See stock/reversal-guard.ts.
      if (STOCK_INCREASE_TYPES.has(existing.type)) {
        const needed = await giveBackForDocument(tx, { businessId, documentId })
        if (willBeSaved) {
          const kept = data.lineItems ?? existing.lineItems
          for (const li of kept) {
            const outstanding = (needed.get(li.productId) ?? 0) - li.quantity
            if (outstanding > 0) needed.set(li.productId, outstanding)
            else needed.delete(li.productId)
          }
        }
        await assertStockGiveBackPossible(tx, { businessId, needed })
      }
      await reverseForInvoice(tx, { businessId, invoiceId: documentId, userId })
    }
    if (wasSaved && AFFECTS_OUTSTANDING.has(existing.type)) {
      const reverseDelta = getOutstandingReverseDelta(existing.type, existing.grandTotal)
      await updateOutstanding(tx, existing.partyId, reverseDelta)
    }

    let totals = null
    if (data.lineItems) {
      const rc = await recomputeLineItemsAndTotals(tx, businessId, documentId, existing, data)
      totals = rc.totals
      moqWarnings = rc.moqWarnings
    }

    let numberData = null
    if (!wasSaved && willBeSaved) {
      const docDate = data.documentDate ? new Date(data.documentDate) : new Date()
      numberData = await generateNextNumber(tx, businessId, existing.type, docDate)
    }

    const updateData: Record<string, unknown> = { updatedBy: userId }
    if (data.status) updateData.status = data.status
    if (data.partyId) updateData.partyId = data.partyId
    if (data.documentDate) updateData.documentDate = new Date(data.documentDate)
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms
    if (data.shippingAddressId !== undefined) updateData.shippingAddressId = data.shippingAddressId
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.termsAndConditions !== undefined) updateData.termsAndConditions = data.termsAndConditions
    if (data.includeSignature !== undefined) updateData.includeSignature = data.includeSignature
    if (data.transportDetails !== undefined) { updateData.vehicleNumber = data.transportDetails?.vehicleNumber || null; updateData.driverName = data.transportDetails?.driverName || null; updateData.transportNotes = data.transportDetails?.transportNotes || null }
    if (numberData) {
      updateData.documentNumber = numberData.documentNumber
      updateData.sequenceNumber = numberData.sequenceNumber
      updateData.financialYear = numberData.financialYear
    }
    if (totals) {
      Object.assign(updateData, {
        subtotal: totals.subtotal, totalDiscount: totals.totalDiscount,
        totalAdditionalCharges: totals.totalAdditionalCharges, roundOff: totals.roundOff,
        grandTotal: totals.grandTotal, totalCost: totals.totalCost,
        totalProfit: totals.totalProfit, profitPercent: totals.profitPercent,
        balanceDue: totals.grandTotal, totalTaxableValue: totals.totalTaxableValue,
        totalCgst: totals.totalCgst, totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst, totalCess: totals.totalCess,
      })
    }
    if (data.placeOfSupply !== undefined) updateData.placeOfSupply = data.placeOfSupply
    if (data.isReverseCharge !== undefined) updateData.isReverseCharge = data.isReverseCharge
    if (data.isComposite !== undefined) updateData.isComposite = data.isComposite
    if (data.taxPricingMode !== undefined) updateData.taxPricingMode = data.taxPricingMode
    if (data.tdsRate !== undefined) updateData.tdsRate = data.tdsRate
    if (data.tdsAmount !== undefined) updateData.tdsAmount = data.tdsAmount
    if (data.tcsRate !== undefined) updateData.tcsRate = data.tcsRate
    if (data.tcsAmount !== undefined) updateData.tcsAmount = data.tcsAmount
    // Epic B PR2: null clears override; undefined = not sent (don't touch existing)
    if (data.priceListId !== undefined) updateData.priceListId = data.priceListId ?? null
    await tx.document.update({ where: { id: documentId }, data: updateData })
    if (data.customFieldValues !== undefined) {
      await persistDocumentCustomFieldValues(tx, {
        businessId,
        documentId,
        documentType: existing.type,
        values: data.customFieldValues,
      })
    }

    const effectivePartyId = data.partyId || existing.partyId
    const effectiveGrandTotal = totals?.grandTotal ?? existing.grandTotal
    if (willBeSaved) {
      const lineItems = data.lineItems || existing.lineItems
      const labels = stockMovementLabels(existing.type)
      if (STOCK_DECREASE_TYPES.has(existing.type)) {
        const docNum = numberData?.documentNumber || ''
        await deductForSaleInvoice(tx, {
          businessId,
          invoiceId: documentId,
          invoiceNumber: docNum,
          items: lineItems.map(li => ({
            productId: li.productId,
            quantity: li.quantity,
            unitId: li.productId,
          })),
          userId,
          movementType: labels.movementType,
          movementReferenceType: labels.referenceType,
        })
      } else if (STOCK_INCREASE_TYPES.has(existing.type)) {
        const docNum = numberData?.documentNumber || ''
        await addForPurchaseInvoice(tx, {
          businessId,
          invoiceId: documentId,
          invoiceNumber: docNum,
          items: lineItems.map(li => ({
            productId: li.productId,
            quantity: li.quantity,
            unitId: li.productId,
            unitCostPaise: (li as { productId: string; quantity: number; rate?: number }).rate,
          })),
          userId,
          movementType: labels.movementType,
          movementReferenceType: labels.referenceType,
        })
      }

      if (AFFECTS_OUTSTANDING.has(existing.type)) {
        const outstandingDelta = getOutstandingDelta(existing.type, effectiveGrandTotal)
        await updateOutstanding(tx, effectivePartyId, outstandingDelta)
      }

      // Epic D PR5 §3.3 — commission accrual only on DRAFT→SAVED transition.
      if (!wasSaved && willBeSaved) {
        commissionOutcome = await accrueForSaleInvoice(tx, {
          businessId, staffUserId: userId, documentId,
          documentDate: data.documentDate ? new Date(data.documentDate) : new Date(),
          documentType: existing.type,
        })
      }
    }

    // S1 — GL: edit-of-posted = VOID the original JE in place, then re-post
    // fresh values. The partial index is scoped to status=POSTED, so the
    // re-post does not collide with the now-VOID original.
    await reverseSourceEntry(tx, businessId, 'DOCUMENT', documentId, 'Document edited')
    if (willBeSaved) {
      const fresh = await tx.document.findFirstOrThrow({
        where: { id: documentId, businessId }, select: POSTING_DOC_SELECT,
      })
      await postDocument(tx, { businessId, userId, doc: fresh })
    }

    // Audit row inside the tx so it commits/rolls back with the mutation.
    await createAuditEntry({
      businessId,
      entityType: 'Document',
      entityId: documentId,
      entityLabel: (numberData?.documentNumber ?? '').slice(0, 120) || null,
      userId,
      action: 'UPDATE',
      changes: data as Record<string, unknown>,
    }, tx)

    // P3.12 — defense-in-depth: re-scope by businessId even though tx pre-check already did
    return tx.document.findFirstOrThrow({ where: { id: documentId, businessId }, select: DOCUMENT_DETAIL_SELECT })
  })
  const affectsStock = STOCK_DECREASE_TYPES.has(existing.type) || STOCK_INCREASE_TYPES.has(existing.type)
  if (affectsStock) {
    const oldProductIds = existing.lineItems.map(li => li.productId)
    const newProductIds = data.lineItems ? data.lineItems.map(li => li.productId) : []
    scheduleAlertChecks(businessId, [...oldProductIds, ...newProductIds])
  }
  emitDocumentCommissionAnalytics(commissionOutcome, { businessId, documentId, staffUserId: userId })
  const r = result as Record<string, unknown>
  if (moqWarnings.length === 0) return r
  return { ...r, warnings: moqWarnings.map(v => ({ code: 'BELOW_MOQ' as const, lineIndex: v.lineIndex, productId: v.productId, productName: v.productName, moq: v.moq, qty: v.qty })) }
}
