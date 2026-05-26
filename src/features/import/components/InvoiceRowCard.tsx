/**
 * Phase 7 Slice 7.1C — Invoice preview row card.
 *
 * Renders one normalized invoice for the preview list. Header carries
 * invoice #, date, party chip (matched-by badge), and grand total. Lines
 * block shows the top 3 lines plus a "+N more" summary row. Per-row
 * issues render as severity-coloured chips beneath the totals.
 *
 * The card is intentionally collapsed-by-default per ARCH §9 — the full
 * `<InvoiceLinesAccordion>` (File Plan #51) is out of scope for this PR,
 * so we surface enough on the card itself to let the user spot blocking
 * issues without an extra tap.
 *
 * Token-only colours; chip styling lives in `InvoiceChips.tsx`. ≤250L.
 */

import { Card } from '@/components/ui/Card'
import { formatPaise, formatDate } from '@/lib/format'
import {
  type ImportPreviewRow,
  type InvoiceIssue,
  type NormalizedInvoice,
  type NormalizedInvoiceLine,
} from '../types/import.types'
import { IssueChip, PartyChip, ProductChip } from './InvoiceChips'

interface InvoiceRowCardProps {
  row: ImportPreviewRow
  t: Record<string, string>
}

const TOP_N_LINES = 3

export function InvoiceRowCard({ row, t }: InvoiceRowCardProps) {
  const norm = row.normalized as Partial<NormalizedInvoice> | null | undefined
  const issues = readIssues(row.issues)

  const documentNumber = norm?.documentNumber ?? '—'
  const documentDate = formatIso(norm?.documentDate)
  const partyName =
    norm?.party?.source?.name ?? (t.importInvoicePartyLabel ?? 'Party')
  const partyMatched = norm?.party?.matchedBy ?? 'NOT_FOUND'

  const lines = Array.isArray(norm?.lines) ? norm.lines : []
  const visibleLines = lines.slice(0, TOP_N_LINES)
  const remaining = lines.length - visibleLines.length

  return (
    <Card variant="default" className="p-4 space-y-3">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col min-w-0">
          <span
            className="font-semibold truncate tabular-nums"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}
          >
            {(t.importInvoiceNumberLabel ?? 'Invoice #')} {documentNumber}
          </span>
          <span
            className="truncate"
            style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}
          >
            {documentDate}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="truncate font-medium"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }}
          >
            {partyName}
          </span>
          <PartyChip matchedBy={partyMatched} t={t} />
        </div>
      </header>

      {lines.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
          {t.importInvoiceNoLines ?? 'No line items on this invoice'}
        </p>
      ) : (
        <ul className="space-y-1">
          {visibleLines.map((line, idx) => (
            <li
              key={`${row.id}-line-${idx}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <ProductChip
                  matchedBy={line.resolved?.matchedBy ?? 'NOT_FOUND'}
                  t={t}
                />
                <span
                  className="truncate"
                  style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }}
                >
                  {line.resolved?.source?.name ?? line.source?.productNameRaw ?? '—'}
                </span>
              </span>
              <span
                className="tabular-nums shrink-0"
                style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}
              >
                {formatQty(line)} · {formatLinePaise(line.lineTotalPaise)}
              </span>
            </li>
          ))}
          {remaining > 0 && (
            <li style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
              {(t.importInvoiceLineMore ?? '+{count} more').replace(
                '{count}',
                String(remaining),
              )}
            </li>
          )}
        </ul>
      )}

      <dl className="grid grid-cols-3 gap-x-3 gap-y-1 pt-1">
        <Stat
          label={t.importInvoiceSubtotal ?? 'Subtotal'}
          value={formatLinePaise(norm?.subtotalPaise ?? null)}
        />
        <Stat
          label={t.importInvoiceTax ?? 'Tax'}
          value={formatLinePaise(sumTax(norm))}
        />
        <Stat
          label={t.importInvoiceGrandTotal ?? 'Grand total'}
          value={formatLinePaise(norm?.grandTotalPaise ?? null)}
          emphasize
        />
      </dl>

      {issues.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Issues on this invoice">
          {issues.map((iss, idx) => (
            <li key={`${row.id}-iss-${idx}`}>
              <IssueChip code={iss.code} t={t} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function readIssues(raw: unknown): InvoiceIssue[] {
  if (!Array.isArray(raw)) return []
  const out: InvoiceIssue[] = []
  for (const r of raw) {
    if (r && typeof r === 'object' && typeof (r as { code?: unknown }).code === 'string') {
      out.push(r as InvoiceIssue)
    }
  }
  return out
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

function formatQty(line: NormalizedInvoiceLine): string {
  const qty =
    typeof line.qty === 'number' && Number.isFinite(line.qty) ? line.qty : 0
  const unit = line.source?.unitRaw?.trim()
  return unit ? `${qty} ${unit}` : String(qty)
}

function sumTax(n: Partial<NormalizedInvoice> | null | undefined): number | null {
  if (!n) return null
  const c = n.totalCgstPaise ?? 0
  const s = n.totalSgstPaise ?? 0
  const i = n.totalIgstPaise ?? 0
  return c + s + i
}

interface StatProps {
  label: string
  value: string
  emphasize?: boolean
}

function Stat({ label, value, emphasize = false }: StatProps) {
  return (
    <div className="flex flex-col">
      <dt style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
        {label}
      </dt>
      <dd
        className={emphasize ? 'font-semibold tabular-nums' : 'tabular-nums'}
        style={{
          fontSize: emphasize ? 'var(--fs-md)' : 'var(--fs-sm)',
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </dd>
    </div>
  )
}
