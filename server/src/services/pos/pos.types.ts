/**
 * POS Checkout — TypeScript interfaces and DTOs
 * All amounts in PAISE (integer). Rates in BASIS POINTS.
 * Prisma-generated types are imported where applicable; DTOs are manual.
 */

import type { PosSale, PosSaleItem, PosSaleEvent } from '@prisma/client'
import type { PaymentMode } from './pos.constants.js'

// ─── Re-export Prisma types used by callers ────────────────────────────────
export type { PosSale, PosSaleItem, PosSaleEvent }

// ─── Service context ────────────────────────────────────────────────────────
/**
 * Minimal request context passed into every POS service function.
 * Extracted from the authenticated request in the route handler.
 */
export interface PosServiceCtx {
  businessId: string
  userId: string   // User.id (cashier)
}

// ─── Input shapes (from validated request body) ────────────────────────────

export interface PosPaymentInput {
  mode: PaymentMode
  amountPaise: number
  referenceNumber?: string
  note?: string
}

export interface PosItemInput {
  productId: string
  quantity: number          // positive, can be decimal (kg, ltr)
  discountType: 'AMOUNT' | 'PERCENTAGE'
  discountValue: number     // paise if AMOUNT, basis points if PERCENTAGE
  batchId?: string
  godownId?: string
  note?: string
}

export interface PosSaleInput {
  /** UUID v4 — deduplicate concurrent/duplicate requests within 24 h. */
  idempotencyKey: string
  /**
   * Optional client-side UUID for offline-first deduplication.
   * Stored on PosSale.clientId with a unique constraint.
   */
  clientId?: string
  items: PosItemInput[]
  payments: PosPaymentInput[]
  /** Provided party ID. Null = walk-in customer. */
  partyId?: string
  walkInName?: string
  walkInPhone?: string
  /** Client-reported grand total (paise). Server validates ≤ TOTAL_DRIFT_TOLERANCE_PAISE drift. */
  clientGrandTotal: number
  saleDate?: string  // ISO 8601 — defaults to now()
  taxPricingMode?: 'EXCLUSIVE' | 'INCLUSIVE'
}

// ─── Internal intermediate types ───────────────────────────────────────────

/**
 * Fully-priced line after server-authoritative pricing engine runs.
 */
export interface PricedLine {
  productId: string
  productName: string
  sku: string | null
  hsnCode: string | null
  unitSymbol: string
  quantity: number
  ratePaise: number
  discountType: 'AMOUNT' | 'PERCENTAGE'
  discountValue: number
  discountAmount: number  // paise — resolved absolute discount
  lineTotal: number       // paise — ratePaise * quantity − discountAmount
  taxCategoryId: string | null
  gstRate: number         // basis points
  cessRate: number        // basis points
  cessType: 'PERCENTAGE' | 'FIXED_PER_UNIT'
  batchId?: string
  godownId?: string
  note?: string
  sortOrder: number
}

/**
 * Per-line result after tax engine runs on a PricedLine.
 */
export interface TaxedLine extends PricedLine {
  taxableValue: number   // paise (= lineTotal for EXCLUSIVE)
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  igstRate: number
  igstAmount: number
  cessAmount: number
  totalLineTax: number
}

/**
 * Resolved party info passed between checkout steps.
 */
export interface PartyResolution {
  partyId: string
  partyName: string
  partyGstin: string | null
  partyStateCode: string | null
  placeOfSupply: string | null  // 2-digit state code
  supplyType: 'B2B' | 'B2C_SMALL' | 'B2C_LARGE'
}

// ─── Response DTOs ──────────────────────────────────────────────────────────

export interface PosSaleItemDTO {
  id: string
  productId: string
  productName: string
  sku: string | null
  hsnCode: string | null
  unitSymbol: string
  quantity: number
  ratePaise: number
  discountType: string
  discountValue: number
  discountAmount: number
  lineTotal: number
  taxableValue: number
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  igstRate: number
  igstAmount: number
  cessRate: number
  cessAmount: number
  batchId: string | null
  batchNumber: string | null
  godownId: string | null
  note: string | null
}

export interface PosSaleDTO {
  id: string
  businessId: string
  documentId: string
  receiptNumber: string
  receiptSeq: number
  financialYear: string
  partyId: string | null
  walkInName: string | null
  walkInPhone: string | null
  subtotal: number
  totalDiscount: number
  totalTaxableValue: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalCess: number
  grandTotal: number
  taxPricingMode: string
  placeOfSupply: string | null
  supplyType: string
  paymentBreakdown: unknown
  status: string
  saleDate: Date
  createdAt: Date
  items: PosSaleItemDTO[]
  warnings: string[]  // non-fatal warnings (e.g. WARN_ONLY oversell)
}
