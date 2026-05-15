/** Document Service — updateDocument */
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
import { assertCompositionNoLineTax, assertCompositionNoInterState } from './create-tax-prep.js'
import { assertMoq, type MoqViolation } from './moq.guard.js'
import { buildLineItemData } from './line-item-builder.js'
import { persistDocumentCustomFieldValues } from './custom-fields.js'

export async function updateDocument(
  businessId: string,
  documentId: string,
  userId: string,
  data: UpdateDocumentInput
) {
  let moqWarnings: MoqViolation[] = []
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

  // Security 2.1: verify priceListId belongs to this business (cross-tenant guard)
  if (data.priceListId) {
    const ownedList = await prisma.priceList.findFirst({ where: { id: data.priceListId, businessId, isDeleted: false }, select: { id: true } })
    if (!ownedList) throw notFoundError('Price list')
  }

  const wasSaved = existing.status === 'SAVED' || existing.status === 'SHARED'
  const willBeSaved = data.status === 'SAVED' || (wasSaved && !data.status)
  const result = await prisma.$transaction(async (tx) => {
    if (wasSaved && (STOCK_DECREASE_TYPES.has(existing.type) || STOCK_INCREASE_TYPES.has(existing.type))) {
      await reverseForInvoice(tx, { businessId, invoiceId: documentId, userId })
    }
    if (wasSaved && AFFECTS_OUTSTANDING.has(existing.type)) {
      const reverseDelta = getOutstandingReverseDelta(existing.type, existing.grandTotal)
      await updateOutstanding(tx, existing.partyId, reverseDelta)
    }

    let totals = null
    if (data.lineItems) {
      const productIds = data.lineItems.map(li => li.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, businessId },
        select: { id: true, name: true, purchasePrice: true, currentStock: true, moq: true },
      })
      const productMap = new Map(products.map(p => [p.id, p]))

      for (const li of data.lineItems) {
        if (!productMap.has(li.productId)) throw notFoundError(`Product ${li.productId}`)
      }

      // MOQ check for applicable doc types — honours DocumentSettings.enforceMoq
      const _s = await tx.documentSettings.findUnique({ where: { businessId }, select: { enforceMoq: true } })
      moqWarnings = assertMoq(existing.type, data.lineItems.map(li => ({ productId: li.productId, quantity: li.quantity })), productMap, _s?.enforceMoq ?? true)

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
      const biz = await tx.business.findUnique({
        where: { id: businessId },
        select: { stateCode: true, compositionScheme: true },
      })

      const roundOffSetting = await getRoundOffSetting(businessId)
      const placeOfSupply = data.placeOfSupply ?? existing.placeOfSupply ?? null
      const isCompositeUpdate = data.isComposite ?? existing.isComposite ?? biz?.compositionScheme ?? false

      assertCompositionNoLineTax(isCompositeUpdate, data.lineItems)
      assertCompositionNoInterState(isCompositeUpdate, biz?.stateCode ?? null, placeOfSupply)
      const calcItems = data.lineItems.map(li => {
        const tc = li.taxCategoryId ? taxCategoryMap.get(li.taxCategoryId) : undefined
        // #133 BOGO — free items contribute 0 to revenue / discount / tax
        if (li.isFreeItem) {
          return {
            quantity: li.quantity,
            rate: 0,
            discountType: li.discountType,
            discountValue: 0,
            purchasePrice: productMap.get(li.productId)!.purchasePrice || 0,
            gstRate: 0,
            cessRate: 0,
            cessType: tc?.cessType ?? 'PERCENTAGE',
          }
        }
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

      await tx.documentLineItem.deleteMany({ where: { documentId } })
      const lineItemData = buildLineItemData(documentId, data.lineItems, productMap, totals!)
      await tx.documentLineItem.createMany({ data: lineItemData })

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
            unitCostPaise: (li as { productId: string; quantity: number; rate?: number }).rate,
          })),
          userId,
        })
      }

      if (AFFECTS_OUTSTANDING.has(existing.type)) {
        const outstandingDelta = getOutstandingDelta(existing.type, effectiveGrandTotal)
        await updateOutstanding(tx, effectivePartyId, outstandingDelta)
      }
    }

    // P3.12 — defense-in-depth: re-scope by businessId even though tx pre-check already did
    return tx.document.findFirstOrThrow({ where: { id: documentId, businessId }, select: DOCUMENT_DETAIL_SELECT })
  })
  const affectsStock = STOCK_DECREASE_TYPES.has(existing.type) || STOCK_INCREASE_TYPES.has(existing.type)
  if (affectsStock) {
    const oldProductIds = existing.lineItems.map(li => li.productId)
    const newProductIds = data.lineItems ? data.lineItems.map(li => li.productId) : []
    scheduleAlertChecks(businessId, [...oldProductIds, ...newProductIds])
  }
  const r = result as Record<string, unknown>
  if (moqWarnings.length === 0) return r
  return { ...r, warnings: moqWarnings.map(v => ({ code: 'BELOW_MOQ' as const, lineIndex: v.lineIndex, productId: v.productId, productName: v.productName, moq: v.moq, qty: v.qty })) }
}
