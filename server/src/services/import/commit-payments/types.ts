/**
 * Phase 7 · 7.1D — Payment commit chunk-local types.
 *
 * Mirrors 7.1C's `commit-invoices/types.ts` shape so the dispatcher
 * contract `(tx, args) => ChunkResult` stays symmetric across entities.
 *
 * Authority: ARCHITECTURE_PHASE7_IMPORT_7_1D.md File Plan row 19.
 */

import type { PaymentMode } from '../normalizers/payment-mode-map.constants.js'

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
  | 'ALLOCATION_INTERNAL_CONFLICT' // 5xx — distinct from OVER_ALLOCATION
  | 'DUPLICATE_PAYMENT'
  | 'INTRA_FILE_DUPLICATE'
  | 'COMMIT_BLOCKED_INVOICE_NOT_FOUND'

export type PaymentIssueSeverity = 'ERROR' | 'WARNING'

export const PAYMENT_ISSUE_SEVERITY: Record<PaymentIssueCode, PaymentIssueSeverity> = {
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
  severity: PaymentIssueSeverity
  message: string
}

export interface NormalizedPayment {
  partyId: string | null
  partyName: string
  partyPhone: string | null
  date: string // ISO yyyy-mm-dd
  amountPaise: number // Int — narrowed
  mode: PaymentMode | null // null = strict reject
  referenceNumber: string | null
  invoiceNumber: string | null // single allocation; multi → MULTI_ALLOCATION_UNSUPPORTED
  invoiceId: string | null // resolved
  notes: string | null
}

export type AllocateRowResult =
  | { skipped: true; code: PaymentIssueCode }
  | { skipped: false; paymentId: string; allocatedInvoiceId: string | null }
