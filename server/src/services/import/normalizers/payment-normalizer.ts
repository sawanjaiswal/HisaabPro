/**
 * Phase 7 · 7.1D PR-D2b — Payment row normalizer.
 *
 * Pure function: takes a `RawPaymentRow` (from any of the 4 payments
 * parsers, all of which already project headers onto the canonical
 * keys defined in `payment-column-dict.constants.ts`) and emits a
 * `NormalizedPayment` ready for the resolver + commit ladder.
 *
 * Responsibilities (pure, no DB):
 *   - paise conversion via `Math.round(rupees * 100)` (paise SSOT)
 *   - mode resolution via `resolveMode` (M12-clean Map lookup)
 *   - reference truncation via `truncateReference` (tail-100 SSOT)
 *   - date parsing via shared `parseInvoiceDate`
 *   - multi-invoice detection via comma sniff
 *   - businessId is accepted + propagated forward (NEVER read req.user
 *     directly; the caller threads businessId from the auth helper).
 *
 * Authority:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §2 (normalize)
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md §8 / §9 / §10
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1 M12 + S3 (truncation)
 */

import type { RawPaymentRow, RowIssue } from '../../../types/import.types.js'
import type {
  NormalizedPayment,
  PaymentIssue,
  PaymentIssueCode,
} from '../commit-payments/types.js'
import { PAYMENT_ISSUE_SEVERITY } from '../commit-payments/types.js'
import { resolveMode } from './payment-mode-map.js'
import { truncateReference } from './payment-utils.js'
import { parseInvoiceDate } from '../invoice/date-parser.util.js'

export interface NormalizePaymentArgs {
  businessId: string // tenant scope — forwarded to dedup/resolver
  row: RawPaymentRow
  strictMode?: boolean // default false (defaults unknown → OTHER)
}

export interface NormalizedPaymentRow {
  businessId: string
  sourceIndex: number
  normalized: NormalizedPayment
  issues: PaymentIssue[]
  // Mirror Phase 7.1A/B RowIssue surface for the preview UI.
  rowIssues: RowIssue[]
}

const MAX_AMOUNT_PAISE = 1_000_000_000_00 // ₹1 crore × 100 paise — Phase 7.1D ceiling
const MAX_NOTES_LEN = 500

function pushIssue(
  issues: PaymentIssue[],
  field: string | null,
  code: PaymentIssueCode,
  message: string,
): void {
  issues.push({
    field,
    code,
    severity: PAYMENT_ISSUE_SEVERITY[code],
    message,
  })
}

function toRowIssues(issues: PaymentIssue[]): RowIssue[] {
  return issues.map((i) => ({
    field: i.field ?? '',
    code: i.code,
    message: i.message,
  }))
}

function rupeesToPaise(raw: string, issues: PaymentIssue[]): number {
  const body = raw.replace(/,/g, '').trim()
  if (!body) {
    pushIssue(issues, 'amount', 'AMOUNT_NEGATIVE', 'Amount is empty')
    return 0
  }
  const n = Number(body)
  if (!Number.isFinite(n)) {
    pushIssue(issues, 'amount', 'AMOUNT_NEGATIVE', 'Amount is not numeric')
    return 0
  }
  if (n < 0) {
    pushIssue(issues, 'amount', 'AMOUNT_NEGATIVE', 'Amount is negative')
    return 0
  }
  const paise = Math.round(n * 100)
  if (paise > MAX_AMOUNT_PAISE) {
    pushIssue(
      issues,
      'amount',
      'AMOUNT_OUT_OF_RANGE',
      `Amount exceeds ${MAX_AMOUNT_PAISE} paise`,
    )
    return MAX_AMOUNT_PAISE
  }
  return paise
}

function normalisePhone(v: string | undefined): string | null {
  if (!v) return null
  const digits = v.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

function normaliseInvoice(
  v: string | undefined,
  issues: PaymentIssue[],
): string | null {
  if (!v) return null
  const trimmed = v.trim()
  if (!trimmed) return null
  if (trimmed.includes(',')) {
    pushIssue(
      issues,
      'invoiceNumber',
      'MULTI_ALLOCATION_UNSUPPORTED',
      'Multiple invoice allocations are not supported',
    )
    return trimmed.split(',')[0]!.trim() || null
  }
  return trimmed
}

function normaliseNotes(v: string | undefined): string | null {
  if (!v) return null
  const t = v.trim()
  if (!t) return null
  return t.length > MAX_NOTES_LEN ? t.slice(0, MAX_NOTES_LEN) : t
}

/**
 * Normalise one raw payment row. Rows are NEVER dropped — even fully
 * malformed rows pass through STAGED so the preview UI shows inline
 * error chips (mirrors party / product normalizer policy).
 */
export function normalizePaymentRow(
  args: NormalizePaymentArgs,
): NormalizedPaymentRow {
  const { businessId, row } = args
  const strictMode = args.strictMode ?? false
  const issues: PaymentIssue[] = []
  const raw = row.raw

  // ── date ─────────────────────────────────────────────────────────
  const dateRes = parseInvoiceDate(raw.date ?? '')
  const date = dateRes.ok ? dateRes.iso : ''
  if (!dateRes.ok) {
    pushIssue(issues, 'date', 'INVALID_DATE', 'Date is missing or unparseable')
  }

  // ── amount ───────────────────────────────────────────────────────
  const amountPaise = rupeesToPaise(raw.amount ?? '', issues)

  // ── mode ─────────────────────────────────────────────────────────
  const modeRes = resolveMode(raw.mode, strictMode)
  if (modeRes.unknown) {
    if (modeRes.defaulted) {
      pushIssue(
        issues,
        'mode',
        'MODE_UNKNOWN_DEFAULTED',
        `Unknown payment mode — defaulted to OTHER`,
      )
    } else {
      pushIssue(
        issues,
        'mode',
        'MODE_UNKNOWN_STRICT',
        `Unknown payment mode (strict-mode reject)`,
      )
    }
  }

  // ── reference ────────────────────────────────────────────────────
  const refRes = truncateReference(raw.referenceNumber)
  const referenceNumber = refRes?.value ?? null
  if (refRes?.truncated) {
    pushIssue(
      issues,
      'referenceNumber',
      'REFERENCE_TRUNCATED',
      'Reference truncated to last 100 characters',
    )
  }

  // ── invoice / notes / party ──────────────────────────────────────
  const invoiceNumber = normaliseInvoice(raw.invoiceNumber, issues)
  const notes = normaliseNotes(raw.notes)
  const partyName = (raw.partyName ?? '').trim()
  const partyPhone = normalisePhone(raw.partyPhone)

  const normalized: NormalizedPayment = {
    partyId: null, // resolved downstream (party-resolver)
    partyName,
    partyPhone,
    date,
    amountPaise,
    mode: modeRes.mode,
    referenceNumber,
    invoiceNumber,
    invoiceId: null, // resolved downstream
    notes,
  }

  return {
    businessId,
    sourceIndex: row.sourceIndex,
    normalized,
    issues,
    rowIssues: toRowIssues(issues),
  }
}
