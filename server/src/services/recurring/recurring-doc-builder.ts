/**
 * Helpers for building the Document data payload when cloning a recurring template.
 * Extracted to keep recurring-generation.service.ts under 250 LOC.
 */

import type { TemplateData } from './clone.js'

interface ScheduleInfo {
  id: string
  businessId: string
}

interface NumberData {
  documentNumber: string
  sequenceNumber: number
  financialYear: string
}

export function buildRecurringDocumentData(
  schedule: ScheduleInfo,
  template: TemplateData,
  documentDate: Date,
  numberData: NumberData,
) {
  return {
    businessId: schedule.businessId,
    type: template.type,
    status: 'SAVED' as const,
    documentNumber: numberData.documentNumber,
    sequenceNumber: numberData.sequenceNumber,
    financialYear: numberData.financialYear,
    partyId: template.partyId,
    shippingAddressId: template.shippingAddressId ?? null,
    documentDate,
    dueDate: null,
    paymentTerms: template.paymentTerms ?? null,
    notes: template.notes ?? null,
    termsAndConditions: template.termsAndConditions ?? null,
    includeSignature: template.includeSignature,
    vehicleNumber: template.vehicleNumber ?? null,
    driverName: template.driverName ?? null,
    transportNotes: template.transportNotes ?? null,
    subtotal: template.subtotal,
    totalDiscount: template.totalDiscount,
    totalAdditionalCharges: template.totalAdditionalCharges,
    roundOff: template.roundOff,
    grandTotal: template.grandTotal,
    totalCost: template.totalCost,
    totalProfit: template.totalProfit,
    profitPercent: template.profitPercent,
    balanceDue: template.grandTotal,
    paidAmount: 0,
    placeOfSupply: template.placeOfSupply ?? null,
    supplyType: template.supplyType,
    isReverseCharge: template.isReverseCharge,
    isComposite: template.isComposite,
    totalTaxableValue: template.totalTaxableValue,
    totalCgst: template.totalCgst,
    totalSgst: template.totalSgst,
    totalIgst: template.totalIgst,
    totalCess: template.totalCess,
    tdsRate: template.tdsRate,
    tdsAmount: template.tdsAmount,
    tcsRate: template.tcsRate,
    tcsAmount: template.tcsAmount,
    recurringInvoiceId: schedule.id,
    isRecurring: false,
    createdBy: 'system',
  }
}
