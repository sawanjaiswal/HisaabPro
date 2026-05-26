/**
 * Phase 7 Slice 7.1D — Payments-side FE type mirror.
 *
 * Source of truth: server/src/services/import/commit-payments/types.ts.
 * Carried inside `row.normalized` for entity='payments' preview rows.
 *
 * Kept in a sibling file (not import.types.ts) so import.types stays under
 * the 250L cap after the 7.1C invoice types landed.
 */

import type { ImportPreviewRow } from './import.types'

export type PaymentIssueCode =
  | 'INVALID_DATE'
  | 'AMOUNT_NEGATIVE'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'PARTY_NOT_FOUND'
  | 'PARTY_AUTO_CREATED'
  | 'PARTY_NAME_ONLY_MATCH'
  | 'INVOICE_NOT_FOUND'
  | 'MODE_UNKNOWN_DEFAULTED'
  | 'MODE_UNKNOWN_STRICT'
  | 'REFERENCE_TRUNCATED'
  | 'MULTI_ALLOCATION_UNSUPPORTED'
  | 'OVER_ALLOCATION'
  | 'ALLOCATION_INTERNAL_CONFLICT'
  | 'DUPLICATE_PAYMENT'
  | 'INTRA_FILE_DUPLICATE'
  | 'COMMIT_BLOCKED_INVOICE_NOT_FOUND'

export const PAYMENT_ISSUE_SEVERITY: Record<PaymentIssueCode, 'ERROR' | 'WARNING'> = {
  INVALID_DATE: 'ERROR',
  AMOUNT_NEGATIVE: 'ERROR',
  AMOUNT_OUT_OF_RANGE: 'ERROR',
  PARTY_NOT_FOUND: 'ERROR',
  PARTY_AUTO_CREATED: 'WARNING',
  PARTY_NAME_ONLY_MATCH: 'WARNING',
  INVOICE_NOT_FOUND: 'ERROR',
  MODE_UNKNOWN_DEFAULTED: 'WARNING',
  MODE_UNKNOWN_STRICT: 'ERROR',
  REFERENCE_TRUNCATED: 'WARNING',
  MULTI_ALLOCATION_UNSUPPORTED: 'WARNING',
  OVER_ALLOCATION: 'ERROR',
  ALLOCATION_INTERNAL_CONFLICT: 'ERROR',
  DUPLICATE_PAYMENT: 'WARNING',
  INTRA_FILE_DUPLICATE: 'ERROR',
  COMMIT_BLOCKED_INVOICE_NOT_FOUND: 'ERROR',
}

export interface PaymentIssue {
  field: string | null
  code: PaymentIssueCode
  severity: 'ERROR' | 'WARNING'
  message: string
}

/**
 * FE-relevant subset of NormalizedPayment (BE writes more). amountPaise
 * is Int4 narrowed BE-side, so number is safe.
 */
export interface NormalizedPayment {
  partyId: string | null
  partyName: string
  partyPhone: string | null
  date: string // ISO yyyy-mm-dd
  amountPaise: number
  mode: string | null // PaymentMode string; null = strict reject
  referenceNumber: string | null
  invoiceNumber: string | null
  invoiceId: string | null
  notes: string | null
}

/** Payment preview row (specialises `ImportPreviewRow.normalized`). */
export interface PaymentPreviewRow extends Omit<ImportPreviewRow, 'normalized'> {
  normalized: NormalizedPayment & Record<string, unknown>
}

/**
 * 409 `COMMIT_BLOCKED_INVOICE_NOT_FOUND` payload — mirror of 7.1C's
 * CommitBlockedProductDetail. Surfaces missing invoice numbers to the
 * CommitBlockedBanner so the user can deep-link into the invoice import.
 */
export interface CommitBlockedInvoiceDetail {
  blockedRowCount: number
  missingInvoiceSample: string[]
}

/** Chip tones for payment match/issue rendering. */
export type PaymentPartyMatchedBy =
  | 'BY_PHONE'
  | 'BY_NAME_AND_PHONE'
  | 'BY_NAME_ONLY'
  | 'FLY_CREATE'
  | 'NOT_FOUND'

export type PaymentInvoiceMatchedBy = 'BY_NUMBER' | 'NOT_FOUND' | 'UNALLOCATED'
