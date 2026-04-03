/**
 * Document Service — Constants and helper functions shared across sub-modules
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'

// === Allowed conversion map ===
export const ALLOWED_CONVERSIONS: Record<string, string[]> = {
  ESTIMATE: ['SALE_ORDER', 'SALE_INVOICE'],
  PROFORMA: ['SALE_INVOICE'],
  SALE_ORDER: ['SALE_INVOICE', 'DELIVERY_CHALLAN'],
  PURCHASE_ORDER: ['PURCHASE_INVOICE'],
  DELIVERY_CHALLAN: ['SALE_INVOICE'],
}

// Types that affect stock
export const STOCK_DECREASE_TYPES = new Set(['SALE_INVOICE', 'DELIVERY_CHALLAN'])
export const STOCK_INCREASE_TYPES = new Set(['PURCHASE_INVOICE', 'CREDIT_NOTE'])

// Types that affect outstanding
export const AFFECTS_OUTSTANDING = new Set(['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'])

// === Helpers ===

export function requireDocument(doc: unknown) {
  if (!doc) throw notFoundError('Document')
  return doc
}

/** Get the round-off setting for a business */
export async function getRoundOffSetting(businessId: string): Promise<string> {
  const settings = await prisma.documentSettings.findUnique({
    where: { businessId },
    select: { roundOffTo: true },
  })
  return settings?.roundOffTo || 'NEAREST_1'
}

/** Apply outstanding balance change to party */
export async function updateOutstanding(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  partyId: string,
  amount: number, // positive = receivable (sale), negative = payable (purchase)
) {
  await tx.party.update({
    where: { id: partyId },
    data: {
      outstandingBalance: { increment: amount },
      totalBusiness: { increment: Math.abs(amount) },
      lastTransactionAt: new Date(),
    },
  })
}

/** Calculate outstanding delta for a document type (positive = receivable, negative = payable) */
export function getOutstandingDelta(type: string, grandTotal: number): number {
  switch (type) {
    case 'SALE_INVOICE': return grandTotal      // party owes us
    case 'PURCHASE_INVOICE': return -grandTotal  // we owe party
    case 'CREDIT_NOTE': return -grandTotal       // reduces receivable
    case 'DEBIT_NOTE': return grandTotal         // increases receivable
    default: return 0
  }
}

/** Reverse outstanding delta (negate the original effect) */
export function getOutstandingReverseDelta(type: string, grandTotal: number): number {
  return -getOutstandingDelta(type, grandTotal)
}
