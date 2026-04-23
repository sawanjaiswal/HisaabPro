/**
 * Template cloning helpers — fetch template data and write cloned line items / charges.
 */

import type { Prisma } from '@prisma/client'

export const TEMPLATE_SELECT: Prisma.DocumentSelect = {
  type: true,
  partyId: true,
  shippingAddressId: true,
  paymentTerms: true,
  notes: true,
  termsAndConditions: true,
  includeSignature: true,
  vehicleNumber: true,
  driverName: true,
  transportNotes: true,
  placeOfSupply: true,
  supplyType: true,
  isReverseCharge: true,
  isComposite: true,
  tdsRate: true,
  tdsAmount: true,
  tcsRate: true,
  tcsAmount: true,
  subtotal: true,
  totalDiscount: true,
  totalAdditionalCharges: true,
  roundOff: true,
  grandTotal: true,
  totalCost: true,
  totalProfit: true,
  profitPercent: true,
  totalTaxableValue: true,
  totalCgst: true,
  totalSgst: true,
  totalIgst: true,
  totalCess: true,
  lineItems: {
    select: {
      productId: true,
      sortOrder: true,
      quantity: true,
      rate: true,
      discountType: true,
      discountValue: true,
      discountAmount: true,
      lineTotal: true,
      purchasePrice: true,
      profit: true,
      profitPercent: true,
      stockBefore: true,
      stockAfter: true,
      taxCategoryId: true,
      hsnCode: true,
      sacCode: true,
      taxableValue: true,
      cgstRate: true,
      cgstAmount: true,
      sgstRate: true,
      sgstAmount: true,
      igstRate: true,
      igstAmount: true,
      cessRate: true,
      cessAmount: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  additionalCharges: {
    select: {
      name: true,
      type: true,
      value: true,
      amount: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
}

export type TemplateData = Prisma.DocumentGetPayload<{
  select: {
    type: true; partyId: true; shippingAddressId: true; paymentTerms: true; notes: true;
    termsAndConditions: true; includeSignature: true; vehicleNumber: true; driverName: true;
    transportNotes: true; placeOfSupply: true; supplyType: true; isReverseCharge: true;
    isComposite: true; tdsRate: true; tdsAmount: true; tcsRate: true; tcsAmount: true;
    subtotal: true; totalDiscount: true; totalAdditionalCharges: true; roundOff: true;
    grandTotal: true; totalCost: true; totalProfit: true; profitPercent: true;
    totalTaxableValue: true; totalCgst: true; totalSgst: true; totalIgst: true; totalCess: true;
    lineItems: { select: {
      productId: true; sortOrder: true; quantity: true; rate: true; discountType: true;
      discountValue: true; discountAmount: true; lineTotal: true; purchasePrice: true;
      profit: true; profitPercent: true; stockBefore: true; stockAfter: true;
      taxCategoryId: true; hsnCode: true; sacCode: true; taxableValue: true;
      cgstRate: true; cgstAmount: true; sgstRate: true; sgstAmount: true;
      igstRate: true; igstAmount: true; cessRate: true; cessAmount: true;
    }; orderBy: { sortOrder: 'asc' } };
    additionalCharges: { select: {
      name: true; type: true; value: true; amount: true; sortOrder: true;
    }; orderBy: { sortOrder: 'asc' } };
  }
}>

type Tx = Prisma.TransactionClient

export async function cloneLineItems(tx: Tx, documentId: string, lineItems: TemplateData['lineItems']) {
  if (lineItems.length === 0) return
  await tx.documentLineItem.createMany({
    data: lineItems.map((li) => ({
      documentId,
      productId: li.productId,
      sortOrder: li.sortOrder,
      quantity: li.quantity,
      rate: li.rate,
      discountType: li.discountType,
      discountValue: li.discountValue,
      discountAmount: li.discountAmount,
      lineTotal: li.lineTotal,
      purchasePrice: li.purchasePrice,
      profit: li.profit,
      profitPercent: li.profitPercent,
      stockBefore: li.stockBefore,
      stockAfter: li.stockAfter,
      taxCategoryId: li.taxCategoryId ?? null,
      hsnCode: li.hsnCode ?? null,
      sacCode: li.sacCode ?? null,
      taxableValue: li.taxableValue,
      cgstRate: li.cgstRate,
      cgstAmount: li.cgstAmount,
      sgstRate: li.sgstRate,
      sgstAmount: li.sgstAmount,
      igstRate: li.igstRate,
      igstAmount: li.igstAmount,
      cessRate: li.cessRate,
      cessAmount: li.cessAmount,
    })),
  })
}

export async function cloneAdditionalCharges(
  tx: Tx,
  documentId: string,
  charges: TemplateData['additionalCharges'],
) {
  if (charges.length === 0) return
  await tx.documentAdditionalCharge.createMany({
    data: charges.map((c) => ({
      documentId,
      name: c.name,
      type: c.type,
      value: c.value,
      amount: c.amount,
      sortOrder: c.sortOrder,
    })),
  })
}
