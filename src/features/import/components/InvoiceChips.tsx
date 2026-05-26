/**
 * Phase 7 Slice 7.1C — Chip atoms for invoice preview rows.
 *
 * Extracted from InvoiceRowCard.tsx to keep that file under the 250L cap.
 * Pure presentation: maps party / product / issue codes to a token-coloured
 * pill. Severity for issues comes from `INVOICE_ISSUE_SEVERITY`.
 */

import {
  INVOICE_ISSUE_SEVERITY,
  type InvoiceIssueCode,
  type InvoicePartyMatchedBy,
  type InvoiceProductMatchedBy,
} from '../types/import.types'

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger'

export function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  const palette = chipPalette(tone)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-full)]"
      style={{
        fontSize: 'var(--fs-xs)',
        color: palette.fg,
        backgroundColor: palette.bg,
      }}
    >
      {label}
    </span>
  )
}

export function PartyChip({
  matchedBy,
  t,
}: {
  matchedBy: InvoicePartyMatchedBy
  t: Record<string, string>
}) {
  const { label, tone } = partyChipMeta(matchedBy, t)
  return <Chip label={label} tone={tone} />
}

export function ProductChip({
  matchedBy,
  t,
}: {
  matchedBy: InvoiceProductMatchedBy
  t: Record<string, string>
}) {
  const { label, tone } = productChipMeta(matchedBy, t)
  return <Chip label={label} tone={tone} />
}

export function IssueChip({
  code,
  t,
}: {
  code: InvoiceIssueCode
  t: Record<string, string>
}) {
  const severity = INVOICE_ISSUE_SEVERITY[code]
  const tone: ChipTone = severity === 'ERROR' ? 'danger' : 'warning'
  const label = t[`importInvoiceIssue_${code}`] ?? code
  return <Chip label={label} tone={tone} />
}

function chipPalette(tone: ChipTone): { fg: string; bg: string } {
  switch (tone) {
    case 'success':
      return { fg: 'var(--color-success-700)', bg: 'var(--color-success-50)' }
    case 'warning':
      return { fg: 'var(--color-warning-700)', bg: 'var(--color-warning-50)' }
    case 'danger':
      return { fg: 'var(--color-danger-700)', bg: 'var(--color-danger-50)' }
    case 'neutral':
    default:
      return { fg: 'var(--color-text-secondary)', bg: 'var(--color-surface-2)' }
  }
}

function partyChipMeta(
  m: InvoicePartyMatchedBy,
  t: Record<string, string>,
): { label: string; tone: ChipTone } {
  switch (m) {
    case 'BY_PHONE':
    case 'BY_NAME_AND_PHONE':
      return { label: t.importInvoicePartyExact ?? 'Existing', tone: 'success' }
    case 'BY_NAME_ONLY':
      return { label: t.importInvoicePartyNameOnly ?? 'Name only', tone: 'warning' }
    case 'FLY_CREATE':
      return { label: t.importInvoicePartyFlyCreate ?? 'New', tone: 'warning' }
    case 'NOT_FOUND':
    default:
      return { label: t.importInvoicePartyNotFound ?? 'Not in your list', tone: 'danger' }
  }
}

function productChipMeta(
  m: InvoiceProductMatchedBy,
  t: Record<string, string>,
): { label: string; tone: ChipTone } {
  switch (m) {
    case 'BY_SKU':
      return { label: t.importInvoiceProductMatched ?? 'Matched', tone: 'success' }
    case 'BY_NAME':
      return { label: t.importInvoiceProductByName ?? 'By name', tone: 'warning' }
    case 'NOT_FOUND':
    default:
      return { label: t.importInvoiceProductMissing ?? 'SKU missing', tone: 'danger' }
  }
}
