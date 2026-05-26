/**
 * Phase 7 Slice 7.1D — Payment preview row card.
 *
 * Renders one normalized payment row. Header: party name + matched-by chip,
 * date, amount (rupee-formatted). Body: invoice link chip + mode/reference
 * meta. Footer: issue chips (severity-coloured).
 *
 * Mirrors InvoiceRowCard.tsx structure so the wizard reads consistently
 * across entities. Token-only colours; ≤250L.
 */

import { Card } from '@/components/ui/Card'
import { formatPaise, formatDate } from '@/lib/format'
import type { ImportPreviewRow } from '../types/import.types'
import type {
  NormalizedPayment,
  PaymentIssue,
  PaymentInvoiceMatchedBy,
  PaymentPartyMatchedBy,
} from '../types/payment.types'
import {
  PaymentPartyChip,
  PaymentInvoiceChip,
  PaymentIssueChip,
} from './PaymentChips'

interface PaymentRowCardProps {
  row: ImportPreviewRow
  t: Record<string, string>
}

export function PaymentRowCard({ row, t }: PaymentRowCardProps) {
  const norm = row.normalized as Partial<NormalizedPayment> | null | undefined
  const issues = readIssues(row.issues)

  const partyName = norm?.partyName ?? (t.importPaymentPartyLabel ?? 'Party')
  const partyMatched = derivePartyMatched(norm, issues)
  const invoiceMatched = deriveInvoiceMatched(norm, issues)
  const invoiceNumber = norm?.invoiceNumber ?? null
  const date = formatIso(norm?.date)
  const amount = formatLinePaise(norm?.amountPaise ?? null)
  const mode = norm?.mode ?? null
  const reference = norm?.referenceNumber ?? null

  return (
    <Card variant="default" className="p-4 space-y-3">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col min-w-0">
          <span
            className="font-semibold truncate"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}
          >
            {partyName}
          </span>
          <span
            className="truncate"
            style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}
          >
            {date}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-semibold tabular-nums"
            style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)' }}
          >
            {amount}
          </span>
          <PaymentPartyChip matchedBy={partyMatched} t={t} />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        <Meta
          label={t.importPaymentModeLabel ?? 'Mode'}
          value={
            mode
              ? (t[`importPaymentMode_${mode}`] ?? mode)
              : (t.importPaymentModeUnknown ?? 'Unknown')
          }
        />
        <Meta
          label={t.importPaymentReferenceLabel ?? 'Reference'}
          value={reference ?? '—'}
        />
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <PaymentInvoiceChip
          matchedBy={invoiceMatched}
          invoiceNumber={invoiceNumber}
          t={t}
        />
        {norm?.notes && (
          <span
            className="truncate"
            style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}
          >
            {norm.notes}
          </span>
        )}
      </div>

      {issues.length > 0 && (
        <ul
          className="flex flex-wrap gap-1.5"
          aria-label={t.importPaymentIssuesAriaLabel ?? 'Issues on this payment'}
        >
          {issues.map((iss, idx) => (
            <li key={`${row.id}-iss-${idx}`}>
              <PaymentIssueChip code={iss.code} t={t} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function readIssues(raw: unknown): PaymentIssue[] {
  if (!Array.isArray(raw)) return []
  const out: PaymentIssue[] = []
  for (const r of raw) {
    if (r && typeof r === 'object' && typeof (r as { code?: unknown }).code === 'string') {
      out.push(r as PaymentIssue)
    }
  }
  return out
}

function derivePartyMatched(
  norm: Partial<NormalizedPayment> | null | undefined,
  issues: PaymentIssue[],
): PaymentPartyMatchedBy {
  if (issues.some((i) => i.code === 'PARTY_NOT_FOUND')) return 'NOT_FOUND'
  if (issues.some((i) => i.code === 'PARTY_AUTO_CREATED')) return 'FLY_CREATE'
  if (issues.some((i) => i.code === 'PARTY_NAME_ONLY_MATCH')) return 'BY_NAME_ONLY'
  return norm?.partyId ? 'BY_PHONE' : 'NOT_FOUND'
}

function deriveInvoiceMatched(
  norm: Partial<NormalizedPayment> | null | undefined,
  issues: PaymentIssue[],
): PaymentInvoiceMatchedBy {
  if (!norm?.invoiceNumber) return 'UNALLOCATED'
  if (issues.some((i) => i.code === 'INVOICE_NOT_FOUND'
    || i.code === 'COMMIT_BLOCKED_INVOICE_NOT_FOUND'
  )) {
    return 'NOT_FOUND'
  }
  return norm.invoiceId ? 'BY_NUMBER' : 'NOT_FOUND'
}

function formatIso(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return formatDate(iso)
  } catch {
    return iso
  }
}

function formatLinePaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return '—'
  return formatPaise(paise)
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <dt style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
        {label}
      </dt>
      <dd
        className="truncate"
        style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }}
      >
        {value}
      </dd>
    </div>
  )
}
