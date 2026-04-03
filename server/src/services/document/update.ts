/**
 * Document Service — updateDocument
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { deductForSaleInvoice, addForPurchaseInvoice, reverseForInvoice, scheduleAlertChecks } from '../stock.service.js'
import { generateNextNumber } from '../document-number.service.js'
import { calculateDocumentTotals, calculateChargeAmount } from '../document-calc.js'
import type { UpdateDocumentInput } from '../../schemas/document.schemas.js'
import { DOCUMENT_DETAIL_SELECT } from './selects.js'
import {
  STOCK_DECREASE_TYPES, STOCK_INCREASE_TYPES, AFFECTS_OUTSTANDING,
  getRoundOffSetting, updateOutstanding, getOutstandingDelta, getOutstandingReverseDelta,
} from './helpers.js'

export async function updateDocument(
  businessId: string,
  documentId: string,
  userId: string,
  data: UpdateDocumentInput
) {
  const existing = await prisma.document.findFirst({
    where: { id: documentId, businessId },
    select: {
      id: true, type: true, status: true, partyId: true, grandTotal: true,
      placeOfSupply: true, isComposite: true,
      lineItems: { select: { productId: true, quantity: true } },
    },
  })
  if (!existing) throw notFoundError('Document')
  if (existing.status === 'CONVERTED') throw validationError('Cannot edit a converted document')
  if (existing.status === 'DELETED') throw validationError('Cannot edit a deleted document')

  const wasSaved = existing.status === 'SAVED' || existing.status === 'SHARED'
  const willBeSaved = data.status === 'SAVED' || (wasSaved && !data.status)

  const result = await prisma.$transaction(async (tx) => {
    // If status was SAVED and we're updating, reverse side effects first
    if (wasSaved && (STOCK_DECREASE_TYPES.has(existing.type) || STOCK_INCREASE_TYPES.has(existing.type))) {
      await reverseForInvoice(tx, { businessId, invoiceId: documentId, userId })
    }
    if (wasSaved && AFFECTS_OUTSTANDING.has(existing.type)) {
      const reverseDelta = getOutstandingReverseDelta(existing.type, existing.grandTotal)
      await updateOutstanding(tx, existing.partyId, reverseDelta)
    }

    // Recalculate if line items changed
    let totals = null
    if (data.lineItems) {
      const productIds = data.lineItems.map(li => li.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, businessId },
        select: { id: true, purchasePrice: true, currentStock: true },
      })
      const productMap = new Map(products.map(p => [p.id, p]))

      for (const li of data.lineItems) {
        if (!productMap.has(li.productId)) throw notFoundError(`Product ${li.productId}`)
      }

      // Fetch TaxCategory cess data for line items
      const taxCategoryIds = data.lineItems
        .map(li => li.taxCategoryId)
        .filter((id): id is string => !!id)
      const taxCategories = taxCategoryIds.length > 0
        ? await tx.taxCategory.findMany({
            where: { id: { in: taxCategoryIds }, businessId },
            select: { id: true, cessRate: true, cessType: true },
          })
        : []
      const taxCategoryMap = new Map(taxCategories.map(tc => [tc.id, tc]))

      // Fetch business state code
      const biz = await tx.business.findUnique({
        where: { id: businessId },
        select: { stateCode: true, compositionScheme: true },
      })

      const roundOffSetting = await getRoundOffSetting(businessId)
      const placeOfSupply = data.placeOfSupply ?? existing.placeOfSupply ?? null
      const isCompositeUpdate = data.isComposite ?? existing.isComposite ?? biz?.compositionScheme ?? false
      const calcItems = data.lineItems.map(li => {
        const tc = li.taxCategoryId ? taxCategoryMap.get(li.taxCategoryId) : undefined
        return {
          quantity: li.quantity,
          rate: li.rate,
          discountType: li.discountType,
          discountValue: li.discountValue,
          purchasePrice: productMap.get(li.productId)!.purchasePrice || 0,
          gstRate: li.gstRate,
          cessRate: tc?.cessRate ?? 0,
          cessType: tc?.cessType ?? 'PERCENTAGE',
        }
      })
      const calcCharges = (data.additionalCharges || []).map(c => ({ type: c.type, value: c.value }))
      totals = calculateDocumentTotals(calcItems, calcCharges, roundOffSetting, {
        businessStateCode: biz?.stateCode ?? null,
        placeOfSupply: placeOfSupply as string | null,
        isComposite: isCompositeUpdate,
      })

      // Replace line items
      await tx.documentLineItem.deleteMany({ where: { documentId } })
      const lineItemData = data.lineItems.map((li, i) => {
        const product = productMap.get(li.productId)!
        const calc = totals!.lineResults[i]
        return {
          documentId,
          productId: li.productId,
          sortOrder: i,
          quantity: li.quantity,
          rate: li.rate,
          discountType: li.discountType,
          discountValue: li.discountValue,
          discountAmount: calc.discountAmount,
          lineTotal: calc.lineTotal,
          purchasePrice: product.purchasePrice || 0,
          profit: calc.profit,
          profitPercent: calc.profitPercent,
          stockBefore: product.currentStock,
          stockAfter: product.currentStock,
          // GST Phase 2
          taxCategoryId: li.taxCategoryId ?? null,
          hsnCode: li.hsnCode ?? null,
          sacCode: li.sacCode ?? null,
          taxableValue: calc.taxableValue ?? 0,
          cgstRate: calc.cgstRate ?? 0,
          cgstAmount: calc.cgstAmount ?? 0,
          sgstRate: calc.sgstRate ?? 0,
          sgstAmount: calc.sgstAmount ?? 0,
          igstRate: calc.igstRate ?? 0,
          igstAmount: calc.igstAmount ?? 0,
          cessRate: calc.cessRate ?? 0,
          cessAmount: calc.cessAmount ?? 0,
        }
      })
      await tx.documentLineItem.createMany({ data: lineItemData })

      // Replace charges
      if (data.additionalCharges) {
        await tx.documentAdditionalCharge.deleteMany({ where: { documentId } })
        if (data.additionalCharges.length > 0) {
          const chargeData = data.additionalCharges.map((c, i) => ({
            documentId,
            name: c.name,
            type: c.type,
            value: c.value,
            amount: calculateChargeAmount(totals!.subtotal, c.type, c.value),
            sortOrder: i,
          }))
          await tx.documentAdditionalCharge.createMany({ data: chargeData })
        }
      }
    }

    // Generate number if transitioning DRAFT -> SAVED
    let numberData = null
    if (!wasSaved && willBeSaved) {
      const docDate = data.documentDate ? new Date(data.documentDate) : new Date()
      numberData = await generateNextNumber(tx, businessId, existing.type, docDate)
    }

    // Update document
    const updateData: Record<string, unknown> = {
      updatedBy: userId,
    }
    if (data.status) updateData.status = data.status
    if (data.partyId) updateData.partyId = data.partyId
    if (data.documentDate) updateData.documentDate = new Date(data.documentDate)
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms
    if (data.shippingAddressId !== undefined) updateData.shippingAddressId = data.shippingAddressId
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.termsAndConditions !== undefined) updateData.termsAndConditions = data.termsAndConditions
    if (data.includeSignature !== undefined) updateData.includeSignature = data.includeSignature
    if (data.transportDetails !== undefined) {
      updateData.vehicleNumber = data.transportDetails?.vehicleNumber || null
      updateData.driverName = data.transportDetails?.driverName || null
      updateData.transportNotes = data.transportDetails?.transportNotes || null
    }
    if (numberData) {
      updateData.documentNumber = numberData.documentNumber
      updateData.sequenceNumber = numberData.sequenceNumber
      updateData.financialYear = numberData.financialYear
    }
    if (totals) {
      updateData.subtotal = totals.subtotal
      updateData.totalDiscount = totals.totalDiscount
      updateData.totalAdditionalCharges = totals.totalAdditionalCharges
      updateData.roundOff = totals.roundOff
      updateData.grandTotal = totals.grandTotal
      updateData.totalCost = totals.totalCost
      updateData.totalProfit = totals.totalProfit
      updateData.profitPercent = totals.profitPercent
      updateData.balanceDue = totals.grandTotal
      // GST Phase 2 totals
      updateData.totalTaxableValue = totals.totalTaxableValue
      updateData.totalCgst = totals.totalCgst
      updateData.totalSgst = totals.totalSgst
      updateData.totalIgst = totals.totalIgst
      updateData.totalCess = totals.totalCess
    }
    // Phase 2 — update GST flags if provided
    if (data.placeOfSupply !== undefined) updateData.placeOfSupply = data.placeOfSupply
    if (data.isReverseCharge !== undefined) updateData.isReverseCharge = data.isReverseCharge
    if (data.isComposite !== undefined) updateData.isComposite = data.isComposite
    // Phase 2B — TDS/TCS
    if (data.tdsRate !== undefined) updateData.tdsRate = data.tdsRate
    if (data.tdsAmount !== undefined) updateData.tdsAmount = data.tdsAmount
    if (data.tcsRate !== undefined) updateData.tcsRate = data.tcsRate
    if (data.tcsAmount !== undefined) updateData.tcsAmount = data.tcsAmount

    await tx.document.update({
      where: { id: documentId },
      data: updateData,
    })

    // Re-apply side effects if saving
    const effectivePartyId = data.partyId || existing.partyId
    const effectiveGrandTotal = totals?.grandTotal ?? existing.grandTotal

    if (willBeSaved) {
      const lineItems = data.lineItems || existing.lineItems
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
          })),
          userId,
        })
      }

      if (AFFECTS_OUTSTANDING.has(existing.type)) {
        const outstandingDelta = getOutstandingDelta(existing.type, effectiveGrandTotal)
        await updateOutstanding(tx, effectivePartyId, outstandingDelta)
      }
    }

    return tx.document.findUniqueOrThrow({
      where: { id: documentId },
      select: DOCUMENT_DETAIL_SELECT,
    })
  })

  // Post-transaction: fire stock alert checks for all affected products
  const affectsStock = STOCK_DECREASE_TYPES.has(existing.type) || STOCK_INCREASE_TYPES.has(existing.type)
  if (affectsStock) {
    const oldProductIds = existing.lineItems.map(li => li.productId)
    const newProductIds = data.lineItems ? data.lineItems.map(li => li.productId) : []
    scheduleAlertChecks(businessId, [...oldProductIds, ...newProductIds])
  }

  return result
}
