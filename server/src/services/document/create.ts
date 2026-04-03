/**
 * Document Service — createDocument
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { deductForSaleInvoice, addForPurchaseInvoice, scheduleAlertChecks } from '../stock.service.js'
import { generateNextNumber } from '../document-number.service.js'
import { calculateDocumentTotals, calculateChargeAmount } from '../document-calc.js'
import type { CreateDocumentInput } from '../../schemas/document.schemas.js'
import { DOCUMENT_DETAIL_SELECT } from './selects.js'
import {
  STOCK_DECREASE_TYPES, STOCK_INCREASE_TYPES, AFFECTS_OUTSTANDING,
  getRoundOffSetting, updateOutstanding,
} from './helpers.js'
// SSE events auto-emitted by middleware/sse-emit.ts on successful responses

export async function createDocument(
  businessId: string,
  userId: string,
  data: CreateDocumentInput
) {
  // Validate party belongs to business
  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId, isActive: true },
    select: { id: true },
  })
  if (!party) throw notFoundError('Party')

  // Validate originalDocumentId for Credit/Debit Notes
  const isCreditDebitNote = data.type === 'CREDIT_NOTE' || data.type === 'DEBIT_NOTE'
  if (isCreditDebitNote && data.originalDocumentId) {
    const originalDoc = await prisma.document.findFirst({
      where: { id: data.originalDocumentId, businessId, status: { in: ['SAVED', 'SHARED'] } },
      select: { id: true, type: true },
    })
    if (!originalDoc) throw validationError('Original document not found or not in saved state')
    if (data.type === 'CREDIT_NOTE' && originalDoc.type !== 'SALE_INVOICE') {
      throw validationError('Credit notes can only reference sale invoices')
    }
    if (data.type === 'DEBIT_NOTE' && originalDoc.type !== 'PURCHASE_INVOICE') {
      throw validationError('Debit notes can only reference purchase invoices')
    }
  }

  // Fetch product data for calculations (include moq for MOQ validation)
  const productIds = data.lineItems.map(li => li.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: { id: true, name: true, purchasePrice: true, currentStock: true, moq: true },
  })
  const productMap = new Map(products.map(p => [p.id, p]))

  // Verify all products exist
  for (const li of data.lineItems) {
    if (!productMap.has(li.productId)) {
      throw notFoundError(`Product ${li.productId}`)
    }
  }

  // Feature #109 — MOQ validation for PURCHASE_ORDER
  if (data.type === 'PURCHASE_ORDER') {
    for (const li of data.lineItems) {
      const product = productMap.get(li.productId)!
      if (product.moq !== null && product.moq !== undefined && li.quantity < product.moq) {
        throw validationError(
          `Quantity for "${product.name}" is below minimum order quantity of ${product.moq}`
        )
      }
    }
  }

  // Fetch TaxCategory data for GST calculations (cess rates come from here)
  const taxCategoryIds = data.lineItems
    .map(li => li.taxCategoryId)
    .filter((id): id is string => !!id)
  const taxCategories = taxCategoryIds.length > 0
    ? await prisma.taxCategory.findMany({
        where: { id: { in: taxCategoryIds }, businessId },
        select: { id: true, cessRate: true, cessType: true },
      })
    : []
  const taxCategoryMap = new Map(taxCategories.map(tc => [tc.id, tc]))

  // Fetch business state code for inter-state determination
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { stateCode: true, compositionScheme: true },
  })

  const roundOffSetting = await getRoundOffSetting(businessId)

  // Build calculation inputs — include GST fields when present
  const calcItems = data.lineItems.map(li => {
    const product = productMap.get(li.productId)!
    const tc = li.taxCategoryId ? taxCategoryMap.get(li.taxCategoryId) : undefined
    return {
      quantity: li.quantity,
      rate: li.rate,
      discountType: li.discountType,
      discountValue: li.discountValue,
      purchasePrice: product.purchasePrice || 0,
      gstRate: li.gstRate,
      cessRate: tc?.cessRate ?? 0,
      cessType: tc?.cessType ?? 'PERCENTAGE',
    }
  })
  const calcCharges = data.additionalCharges.map(c => ({
    type: c.type,
    value: c.value,
  }))

  const isComposite = data.isComposite ?? business?.compositionScheme ?? false
  const totals = calculateDocumentTotals(calcItems, calcCharges, roundOffSetting, {
    businessStateCode: business?.stateCode ?? null,
    placeOfSupply: data.placeOfSupply ?? null,
    isComposite,
  })
  const isSaving = data.status === 'SAVED'

  const result = await prisma.$transaction(async (tx) => {
    // Generate document number only when SAVING (not DRAFT)
    let numberData: { documentNumber: string; sequenceNumber: number; financialYear: string } | null = null
    if (isSaving) {
      numberData = await generateNextNumber(tx, businessId, data.type, new Date(data.documentDate))
    }

    // Create document
    const doc = await tx.document.create({
      data: {
        businessId,
        type: data.type,
        status: data.status,
        documentNumber: numberData?.documentNumber || null,
        sequenceNumber: numberData?.sequenceNumber || null,
        financialYear: numberData?.financialYear || null,
        partyId: data.partyId,
        shippingAddressId: data.shippingAddressId || null,
        documentDate: new Date(data.documentDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        paymentTerms: data.paymentTerms || null,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalAdditionalCharges: totals.totalAdditionalCharges,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        totalCost: totals.totalCost,
        totalProfit: totals.totalProfit,
        profitPercent: totals.profitPercent,
        balanceDue: totals.grandTotal,
        notes: data.notes || null,
        termsAndConditions: data.termsAndConditions || null,
        includeSignature: data.includeSignature,
        vehicleNumber: data.transportDetails?.vehicleNumber || null,
        driverName: data.transportDetails?.driverName || null,
        transportNotes: data.transportDetails?.transportNotes || null,
        createdBy: userId,
        clientId: data.clientId || null,
        // Phase 2 — GST
        placeOfSupply: data.placeOfSupply || null,
        isReverseCharge: data.isReverseCharge || false,
        isComposite,
        totalTaxableValue: totals.totalTaxableValue,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        totalCess: totals.totalCess,
        // Phase 2 — Credit/Debit Note
        originalDocumentId: data.originalDocumentId || null,
        creditDebitReason: data.creditDebitReason || null,
        // Phase 2B — TDS/TCS
        tdsRate: data.tdsRate ?? 0,
        tdsAmount: data.tdsAmount ?? 0,
        tcsRate: data.tcsRate ?? 0,
        tcsAmount: data.tcsAmount ?? 0,
      },
    })

    // Create line items
    const lineItemData = data.lineItems.map((li, i) => {
      const product = productMap.get(li.productId)!
      const calc = totals.lineResults[i]
      return {
        documentId: doc.id,
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

    // Create additional charges
    if (data.additionalCharges.length > 0) {
      const chargeData = data.additionalCharges.map((c, i) => ({
        documentId: doc.id,
        name: c.name,
        type: c.type,
        value: c.value,
        amount: calculateChargeAmount(totals.subtotal, c.type, c.value),
        sortOrder: i,
      }))
      await tx.documentAdditionalCharge.createMany({ data: chargeData })
    }

    // Side effects only when SAVING
    if (isSaving) {
      // Stock effects
      if (STOCK_DECREASE_TYPES.has(data.type)) {
        await deductForSaleInvoice(tx, {
          businessId,
          invoiceId: doc.id,
          invoiceNumber: numberData!.documentNumber,
          items: data.lineItems.map(li => ({
            productId: li.productId,
            quantity: li.quantity,
            unitId: li.unitId,
          })),
          userId,
        })
      } else if (STOCK_INCREASE_TYPES.has(data.type)) {
        await addForPurchaseInvoice(tx, {
          businessId,
          invoiceId: doc.id,
          invoiceNumber: numberData!.documentNumber,
          items: data.lineItems.map(li => ({
            productId: li.productId,
            quantity: li.quantity,
            unitId: li.unitId,
          })),
          userId,
        })
      }

      // Outstanding effects
      if (AFFECTS_OUTSTANDING.has(data.type)) {
        let outstandingDelta: number
        if (data.type === 'SALE_INVOICE') {
          outstandingDelta = totals.grandTotal
        } else if (data.type === 'PURCHASE_INVOICE') {
          outstandingDelta = -totals.grandTotal
        } else if (data.type === 'CREDIT_NOTE') {
          outstandingDelta = -totals.grandTotal
        } else {
          outstandingDelta = totals.grandTotal
        }
        await updateOutstanding(tx, data.partyId, outstandingDelta)
      }
    }

    // Fetch complete document for response
    return tx.document.findUniqueOrThrow({
      where: { id: doc.id },
      select: DOCUMENT_DETAIL_SELECT,
    })
  })

  // Post-transaction: fire stock alert checks (never blocks response)
  if (isSaving && (STOCK_DECREASE_TYPES.has(data.type) || STOCK_INCREASE_TYPES.has(data.type))) {
    const alertProductIds = data.lineItems.map(li => li.productId)
    scheduleAlertChecks(businessId, alertProductIds)
  }

  return result
}
