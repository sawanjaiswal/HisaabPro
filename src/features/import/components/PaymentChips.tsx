/**
 * Phase 7 Slice 7.1D — Chip atoms for payment preview rows.
 *
 * Mirror of InvoiceChips.tsx; kept separate so payment issue codes and
 * invoice-link match logic don't widen the invoice file. Pure presentation;
 * severity comes from `PAYMENT_ISSUE_SEVERITY`.
 */

import {
  PAYMENT_ISSUE_SEVERITY,
  type PaymentIssueCode,
  type PaymentPartyMatchedBy,
  type PaymentInvoiceMatchedBy,
} from '../types/payment.types'
import { Chip, type ChipTone } from './InvoiceChips'

export function PaymentPartyChip({
  matchedBy,
  t,
}: {
  matchedBy: PaymentPartyMatchedBy
  t: Record<string, string>
}) {
  const { label, tone } = partyChipMeta(matchedBy, t)
  return <Chip label={label} tone={tone} />
}

export function PaymentInvoiceChip({
  matchedBy,
  invoiceNumber,
  t,
}: {
  matchedBy: PaymentInvoiceMatchedBy
  invoiceNumber: string | null
  t: Record<string, string>
}) {
  const { label, tone } = invoiceChipMeta(matchedBy, invoiceNumber, t)
  return <Chip label={label} tone={tone} />
}

export function PaymentIssueChip({
  code,
  t,
}: {
  code: PaymentIssueCode
  t: Record<string, string>
}) {
  const severity = PAYMENT_ISSUE_SEVERITY[code]
  const tone: ChipTone = severity === 'ERROR' ? 'danger' : 'warning'
  const label = t[`importPaymentIssue_${code}`] ?? code
  return <Chip label={label} tone={tone} />
}

function partyChipMeta(
  m: PaymentPartyMatchedBy,
  t: Record<string, string>,
): { label: string; tone: ChipTone } {
  switch (m) {
    case 'BY_PHONE':
    case 'BY_NAME_AND_PHONE':
      return { label: t.importPaymentPartyExact ?? 'Existing', tone: 'success' }
    case 'BY_NAME_ONLY':
      return { label: t.importPaymentPartyNameOnly ?? 'Name only', tone: 'warning' }
    case 'FLY_CREATE':
      return { label: t.importPaymentPartyFlyCreate ?? 'New', tone: 'warning' }
    case 'NOT_FOUND':
    default:
      return { label: t.importPaymentPartyNotFound ?? 'Not in your list', tone: 'danger' }
  }
}

function invoiceChipMeta(
  m: PaymentInvoiceMatchedBy,
  invoiceNumber: string | null,
  t: Record<string, string>,
): { label: string; tone: ChipTone } {
  switch (m) {
    case 'BY_NUMBER':
      return {
        label: invoiceNumber
          ? (t.importPaymentInvoiceLinkedTo ?? 'Invoice #{n}').replace('{n}', invoiceNumber)
          : (t.importPaymentInvoiceMatched ?? 'Invoice matched'),
        tone: 'success',
      }
    case 'UNALLOCATED':
      return { label: t.importPaymentInvoiceUnallocated ?? 'Unallocated', tone: 'neutral' }
    case 'NOT_FOUND':
    default:
      return { label: t.importPaymentInvoiceNotFound ?? 'Invoice not found', tone: 'danger' }
  }
}
