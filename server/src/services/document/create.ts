/** Document Service — createDocument */
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { deductForSaleInvoice, addForPurchaseInvoice, scheduleAlertChecks } from '../stock.service.js'
import { generateNextNumber } from '../document-number.service.js'
import { calculateChargeAmount } from '../document-calc.js'
import {
  assertGstEnabled, assertCompositionNoLineTax, buildCalcItems,
  computeGstTotals, resolveSupplyType,
} from './create-tax-prep.js'
import { getCompositionInvoiceInfo } from '../composition.service.js'
import type { CreateDocumentInput } from '../../schemas/document.schemas.js'
import { DOCUMENT_DETAIL_SELECT } from './selects.js'
import {
  STOCK_DECREASE_TYPES, STOCK_INCREASE_TYPES, AFFECTS_OUTSTANDING,
  getRoundOffSetting, updateOutstanding,
} from './helpers.js'
import { validateLineItemProducts } from './create-batch-validation.js'

export async function createDocument(
  businessId: string,
  userId: string,
  data: CreateDocumentInput
) {
  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId, isActive: true },
    select: { id: true, gstin: true },
  })
  if (!party) throw notFoundError('Party')

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

  const { products, productMap } = await validateLineItemProducts(businessId, data)

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

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { stateCode: true, compositionScheme: true, gstEnabled: true },
  })
  const roundOffSetting = await getRoundOffSetting(businessId)

  assertGstEnabled(data, business)

  const taxPricingMode = data.taxPricingMode ?? 'EXCLUSIVE'
  const isComposite = data.isComposite ?? business?.compositionScheme ?? false
  const isReverseCharge = data.isReverseCharge ?? false

  assertCompositionNoLineTax(isComposite, data.lineItems)
  const purchasePriceMap = new Map(products.map(p => [p.id, p.purchasePrice || 0]))

  const calcItems = buildCalcItems(
    data.lineItems, purchasePriceMap, taxCategoryMap, taxPricingMode, isComposite,
  )
  const calcCharges = data.additionalCharges.map(c => ({ type: c.type, value: c.value }))

  const totals = computeGstTotals(
    calcItems, calcCharges, roundOffSetting, business,
    data.placeOfSupply ?? null, isComposite, isReverseCharge,
  )
  const supplyType = resolveSupplyType(party.gstin ?? null, totals.grandTotal)
  const isSaving = data.status === 'SAVED'

  // BAT-03: capture expiry warnings that survive the tx boundary
  let saleStockWarnings: string[] = []

  const result = await prisma.$transaction(async (tx) => {
    let numberData: { documentNumber: string; sequenceNumber: number; financialYear: string } | null = null
    if (isSaving) {
      numberData = await generateNextNumber(tx, businessId, data.type, new Date(data.documentDate))
    }

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
        placeOfSupply: data.placeOfSupply || null,
        isReverseCharge,
        isComposite,
        taxPricingMode,
        supplyType,
        totalTaxableValue: totals.totalTaxableValue,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        totalCess: totals.totalCess,
        originalDocumentId: data.originalDocumentId || null,
        creditDebitReason: data.creditDebitReason || null,
        tdsRate: data.tdsRate ?? 0,
        tdsAmount: data.tdsAmount ?? 0,
        tcsRate: data.tcsRate ?? 0,
        tcsAmount: data.tcsAmount ?? 0,
      },
    })

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

    if (isSaving) {
      let stockMovements: Array<{ productId: string; balanceAfter: number }> = []
      let stockWarnings: string[] = []

      if (STOCK_DECREASE_TYPES.has(data.type)) {
        const saleResult = await deductForSaleInvoice(tx, {
          businessId, invoiceId: doc.id, invoiceNumber: numberData!.documentNumber,
          items: data.lineItems.map(li => ({ productId: li.productId, quantity: li.quantity, unitId: li.unitId })),
          userId,
        })
        stockMovements = saleResult.movements as Array<{ productId: string; balanceAfter: number }>
        stockWarnings = saleResult.warnings
      } else if (STOCK_INCREASE_TYPES.has(data.type)) {
        stockMovements = await addForPurchaseInvoice(tx, {
          businessId, invoiceId: doc.id, invoiceNumber: numberData!.documentNumber,
          items: data.lineItems.map(li => ({ productId: li.productId, quantity: li.quantity, unitId: li.unitId, unitCostPaise: li.rate })),
          userId,
        })
      }

      // Fix stockAfter: set post-adjustment balanceAfter from each movement (was == stockBefore)
      if (stockMovements.length > 0) {
        const balanceMap = new Map(stockMovements.map(m => [m.productId, Number(m.balanceAfter)]))
        for (const [productId, stockAfter] of balanceMap) {
          await tx.documentLineItem.updateMany({ where: { documentId: doc.id, productId }, data: { stockAfter } })
        }
      }

      // Stash warnings so they survive the tx boundary (read after $transaction resolves)
      if (stockWarnings.length > 0) {
        // Attached to the closure — surfaced in the route via warnings below
        saleStockWarnings = stockWarnings
      }

      if (AFFECTS_OUTSTANDING.has(data.type)) {
        const negative = data.type === 'PURCHASE_INVOICE' || data.type === 'CREDIT_NOTE'
        await updateOutstanding(tx, data.partyId, negative ? -totals.grandTotal : totals.grandTotal)
      }
    }

    return tx.document.findUniqueOrThrow({ where: { id: doc.id }, select: DOCUMENT_DETAIL_SELECT })
  })

  if (isSaving && (STOCK_DECREASE_TYPES.has(data.type) || STOCK_INCREASE_TYPES.has(data.type))) {
    scheduleAlertChecks(businessId, data.lineItems.map(li => li.productId))
  }

  // Append transient compositionLiability (1%/5%/6% on grandTotal) — not persisted
  const compositionInfo = getCompositionInvoiceInfo(isComposite, 'default', result.grandTotal)
  const baseResult = compositionInfo
    ? { ...result, compositionLiability: compositionInfo.compositionTax }
    : result

  // BAT-03: surface expiry warnings in the 200 response (WARN_ONLY policy)
  if (saleStockWarnings.length > 0) {
    return { ...baseResult, warnings: saleStockWarnings }
  }
  return baseResult
}
