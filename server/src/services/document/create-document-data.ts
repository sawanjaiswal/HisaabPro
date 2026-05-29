/** Document Service — Prisma create payload builder for createDocument */
import type { Prisma } from '@prisma/client'
import type { CreateDocumentInput } from '../../schemas/document.schemas.js'
import type { computeGstTotals } from './create-tax-prep.js'

type Totals = ReturnType<typeof computeGstTotals>
type NumberData = { documentNumber: string; sequenceNumber: number; financialYear: string } | null

export function buildDocumentCreateData(args: {
  businessId: string
  userId: string
  data: CreateDocumentInput
  numberData: NumberData
  totals: Totals
  supplyType: string
  isReverseCharge: boolean
  isComposite: boolean
  taxPricingMode: string
}): Prisma.DocumentUncheckedCreateInput {
  const { businessId, userId, data, numberData, totals, supplyType, isReverseCharge, isComposite, taxPricingMode } = args
  return {
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
    // Epic B PR2 — price-list override (already cross-tenant-verified above)
    priceListId: data.priceListId ?? null,
  }
}
