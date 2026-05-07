/**
 * POS Checkout — Persistence Helpers
 *
 * Extracted from pos-checkout.service.ts to keep that file ≤ 250 lines.
 * Creates PosSale, PosSaleItem rows and builds the PosSaleDTO.
 * MUST be called within the outer Prisma $transaction.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { TaxedLine, PosSaleDTO, PosSaleItemDTO, PartyResolution } from './pos.types.js'
import type { TaxSummary } from '../tax-calc.types.js'
import type { InventoryResult } from './pos-checkout.inventory.js'
import type { CreatePosSaleInput } from './pos.validators.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface PersistPosSaleParams {
  businessId: string
  userId: string
  documentId: string
  receiptNumber: string
  receiptSeq: number
  financialYear: string
  partyResolution: PartyResolution
  input: CreatePosSaleInput
  taxedLines: TaxedLine[]
  taxSummary: TaxSummary
  subtotal: number
  totalDiscount: number
  grandTotal: number
  taxPricingMode: string
  saleDate: Date
  inventoryResult: InventoryResult
}

/**
 * Create the PosSale row and all PosSaleItem rows inside the transaction.
 * Returns the new PosSale id and the batch number map for DTO construction.
 */
export async function persistPosSale(
  tx: TxClient,
  p: PersistPosSaleParams
): Promise<{ posSaleId: string; batchNumberMap: Map<string, string> }> {
  const { businessId, userId, input, taxedLines, taxSummary, inventoryResult } = p

  const posSale = await tx.posSale.create({
    data: {
      businessId,
      documentId: p.documentId,
      receiptNumber: p.receiptNumber,
      receiptSeq: p.receiptSeq,
      financialYear: p.financialYear,
      partyId: p.partyResolution.partyId,
      walkInName: input.walkInName ?? null,
      walkInPhone: input.walkInPhone ?? null,
      subtotal: p.subtotal,
      totalDiscount: p.totalDiscount,
      totalTaxableValue: taxSummary.totalTaxableValue,
      totalCgst: taxSummary.totalCgst,
      totalSgst: taxSummary.totalSgst,
      totalIgst: taxSummary.totalIgst,
      totalCess: taxSummary.totalCess,
      grandTotal: p.grandTotal,
      taxPricingMode: p.taxPricingMode,
      placeOfSupply: p.partyResolution.placeOfSupply,
      supplyType: p.partyResolution.supplyType,
      paymentBreakdown: input.payments as unknown as object[],
      cashierId: userId,
      status: 'ACTIVE',
      idempotencyKey: input.idempotencyKey,
      clientId: input.clientId ?? null,
      saleDate: p.saleDate,
    },
    select: { id: true },
  })

  // Resolve batch numbers for items (one query)
  const batchNumberMap = new Map<string, string>()
  if (inventoryResult.batchClaims.size > 0) {
    const batchIds = [...inventoryResult.batchClaims.values()]
    const batches = await tx.batch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, batchNumber: true },
    })
    batches.forEach(b => batchNumberMap.set(b.id, b.batchNumber))
  }

  await tx.posSaleItem.createMany({
    data: taxedLines.map(line => {
      const claimedBatchId =
        inventoryResult.batchClaims.get(line.productId) ?? line.batchId ?? null
      return {
        posSaleId: posSale.id,
        sortOrder: line.sortOrder,
        productId: line.productId,
        productName: line.productName,
        sku: line.sku,
        hsnCode: line.hsnCode,
        unitSymbol: line.unitSymbol,
        quantity: line.quantity,
        ratePaise: line.ratePaise,
        discountType: line.discountType,
        discountValue: line.discountValue,
        discountAmount: line.discountAmount,
        lineTotal: line.lineTotal,
        taxableValue: line.taxableValue,
        cgstRate: line.cgstRate,
        cgstAmount: line.cgstAmount,
        sgstRate: line.sgstRate,
        sgstAmount: line.sgstAmount,
        igstRate: line.igstRate,
        igstAmount: line.igstAmount,
        cessRate: line.cessRate,
        cessAmount: line.cessAmount,
        batchId: claimedBatchId,
        batchNumber: claimedBatchId ? (batchNumberMap.get(claimedBatchId) ?? null) : null,
        godownId: line.godownId ?? null,
        note: line.note ?? null,
      }
    }),
  })

  return { posSaleId: posSale.id, batchNumberMap }
}

/** Build PosSaleDTO from fully-resolved data (no DB calls). */
export function buildPosSaleDTO(
  posSaleId: string,
  documentId: string,
  p: PersistPosSaleParams,
  batchNumberMap: Map<string, string>
): PosSaleDTO {
  const { input, taxedLines, taxSummary, inventoryResult, partyResolution } = p

  const itemDTOs: PosSaleItemDTO[] = taxedLines.map((line, idx) => {
    const claimedBatchId =
      inventoryResult.batchClaims.get(line.productId) ?? line.batchId ?? null
    return {
      id: `idx:${idx}`,   // createMany does not return IDs — route handler can re-fetch if needed
      productId: line.productId,
      productName: line.productName,
      sku: line.sku,
      hsnCode: line.hsnCode,
      unitSymbol: line.unitSymbol,
      quantity: line.quantity,
      ratePaise: line.ratePaise,
      discountType: line.discountType,
      discountValue: line.discountValue,
      discountAmount: line.discountAmount,
      lineTotal: line.lineTotal,
      taxableValue: line.taxableValue,
      cgstRate: line.cgstRate,
      cgstAmount: line.cgstAmount,
      sgstRate: line.sgstRate,
      sgstAmount: line.sgstAmount,
      igstRate: line.igstRate,
      igstAmount: line.igstAmount,
      cessRate: line.cessRate,
      cessAmount: line.cessAmount,
      batchId: claimedBatchId,
      batchNumber: claimedBatchId ? (batchNumberMap.get(claimedBatchId) ?? null) : null,
      godownId: line.godownId ?? null,
      note: line.note ?? null,
    }
  })

  return {
    id: posSaleId,
    businessId: p.businessId,
    documentId,
    receiptNumber: p.receiptNumber,
    receiptSeq: p.receiptSeq,
    financialYear: p.financialYear,
    partyId: partyResolution.partyId,
    walkInName: input.walkInName ?? null,
    walkInPhone: input.walkInPhone ?? null,
    subtotal: p.subtotal,
    totalDiscount: p.totalDiscount,
    totalTaxableValue: taxSummary.totalTaxableValue,
    totalCgst: taxSummary.totalCgst,
    totalSgst: taxSummary.totalSgst,
    totalIgst: taxSummary.totalIgst,
    totalCess: taxSummary.totalCess,
    grandTotal: p.grandTotal,
    taxPricingMode: p.taxPricingMode,
    placeOfSupply: partyResolution.placeOfSupply,
    supplyType: partyResolution.supplyType,
    paymentBreakdown: input.payments,
    status: 'ACTIVE',
    saleDate: p.saleDate,
    createdAt: new Date(),
    items: itemDTOs,
    warnings: inventoryResult.warnings,
  }
}
