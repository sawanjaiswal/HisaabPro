/** Invoice Document Helpers — Pure utility functions
 *
 * No hooks, no side effects. All functions: input → output.
 * Handles payment status, due dates, document numbering,
 * financial year, type conversions, and stock/outstanding effects.
 */

import { toLocalISODate } from '@/lib/format'
import {
  ALLOWED_CONVERSIONS,
  AFFECTS_STOCK,
  AFFECTS_OUTSTANDING,
  DOCUMENT_DIRECTION,
  PAYMENT_TERMS_DAYS,
  INVOICE_NUMBER_PADDING,
  INVOICE_NUMBER_SEPARATOR,
} from './invoice.constants'
import type {
  DocumentType,
  PaymentTerms,
  PaymentStatus,
} from './invoice.types'

// ─── Payment status ────────────────────────────────────────────────────────────

/**
 * Derive payment status from grand total and amount paid (both in paise).
 *
 * PAID    → paidAmount >= grandTotal (fully paid)
 * PARTIAL → paidAmount > 0 but < grandTotal
 * UNPAID  → paidAmount = 0
 */
export function getPaymentStatus(
  grandTotal: number,
  paidAmount: number,
): PaymentStatus {
  if (paidAmount <= 0) return 'UNPAID'
  if (paidAmount >= grandTotal) return 'PAID'
  return 'PARTIAL'
}

// ─── Due date helpers ─────────────────────────────────────────────────────────

/**
 * Days overdue as of today.
 * Returns 0 if not overdue or dueDate is in the future.
 *
 * getDaysOverdue("2026-03-01") with today = 2026-03-15 → 14
 * getDaysOverdue("2026-04-01") with today = 2026-03-15 → 0
 */
export function getDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  // Strip time components for a clean day comparison
  due.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diffMs = now.getTime() - due.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Calculate due date from document date and payment terms.
 * Returns an ISO date string "YYYY-MM-DD".
 *
 * CUSTOM → returns documentDate unchanged (caller must set explicit due date).
 * COD    → returns documentDate (due same day).
 */
export function calculateDueDate(
  documentDate: string,
  paymentTerms: PaymentTerms,
): string {
  const days = PAYMENT_TERMS_DAYS[paymentTerms]
  const date = new Date(documentDate)
  date.setDate(date.getDate() + days)
  return toLocalISODate(date)
}

// ─── Document number generation ───────────────────────────────────────────────

/**
 * Generate a formatted document number from its components.
 *
 * generateDocumentNumber('INV', '2526', 1, 3, '-') → "INV-2526-001"
 * generateDocumentNumber('PI',  '2526', 42, 3, '-') → "PI-2526-042"
 * generateDocumentNumber('EST', '2526', 1000, 3, '-') → "EST-2526-1000" (no truncation)
 */
export function generateDocumentNumber(
  prefix: string,
  financialYear: string,
  sequence: number,
  padding: number,
  separator: string,
): string {
  const padded = sequence.toString().padStart(padding, '0')
  return `${prefix}${separator}${financialYear}${separator}${padded}`
}

/**
 * Generate a document number using the default separator and padding.
 * generateDefaultDocumentNumber('INV', '2526', 5) → "INV-2526-005"
 */
export function generateDefaultDocumentNumber(
  prefix: string,
  financialYear: string,
  sequence: number,
): string {
  return generateDocumentNumber(
    prefix,
    financialYear,
    sequence,
    INVOICE_NUMBER_PADDING,
    INVOICE_NUMBER_SEPARATOR,
  )
}

// ─── Financial year ────────────────────────────────────────────────────────────

/**
 * Return the current Indian financial year in SHORT format.
 * Indian FY runs April 1 → March 31.
 *
 * April 2025 – March 2026 → "2526"
 * April 2026 – March 2027 → "2627"
 */
export function getCurrentFinancialYear(): string {
  const now = new Date()
  const month = now.getMonth()  // 0-indexed: 0=Jan, 3=Apr
  const year = now.getFullYear()

  // If month is Jan-Mar (0-2), we are in the tail of the previous FY
  const startYear = month >= 3 ? year : year - 1
  const endYear = startYear + 1

  // "2526" = last 2 digits of startYear + last 2 digits of endYear
  const start2 = String(startYear).slice(-2)
  const end2 = String(endYear).slice(-2)
  return `${start2}${end2}`
}

// ─── Conversion helpers ────────────────────────────────────────────────────────

/**
 * Whether a source document type can be converted to a target type.
 * Returns false for terminal types (SALE_INVOICE, PURCHASE_INVOICE) and invalid combos.
 */
export function isConversionAllowed(
  sourceType: DocumentType,
  targetType: DocumentType,
): boolean {
  const allowed = ALLOWED_CONVERSIONS[sourceType]
  if (!allowed) return false
  return (allowed as DocumentType[]).includes(targetType)
}

// ─── Stock / outstanding effects ─────────────────────────────────────────────

/**
 * The direction in which a document type affects inventory.
 *
 * INCREASE → stock goes up (Purchase Invoice)
 * DECREASE → stock goes down (Sale Invoice, Delivery Challan)
 * NONE     → no stock movement
 */
export function getStockEffect(
  type: DocumentType,
): 'INCREASE' | 'DECREASE' | 'NONE' {
  if (!AFFECTS_STOCK[type]) return 'NONE'
  return DOCUMENT_DIRECTION[type] === 'INWARD' ? 'INCREASE' : 'DECREASE'
}

/**
 * The direction in which a document type affects party outstanding balance.
 *
 * RECEIVABLE → party owes us (Sale Invoice: their balance goes up)
 * PAYABLE    → we owe party  (Purchase Invoice: our liability goes up)
 * NONE       → no outstanding change
 */
export function getOutstandingEffect(
  type: DocumentType,
): 'RECEIVABLE' | 'PAYABLE' | 'NONE' {
  if (!AFFECTS_OUTSTANDING[type]) return 'NONE'
  return DOCUMENT_DIRECTION[type] === 'OUTWARD' ? 'RECEIVABLE' : 'PAYABLE'
}
