/**
 * Phase 7 · 7.1C — Invoice multi-line aggregator.
 *
 * ARCH §2.2 (AUDIT S4): aggregation runs in the **normalize phase,
 * before staging**. Each emitted `AggregatedInvoiceGroup` becomes one
 * `ImportJobRow` row downstream — line splits across chunk-tx
 * boundaries are impossible by construction.
 *
 * Algorithm:
 *   1. Group `RawInvoiceLineRow[]` by `(lower(invoiceNumber), iso(date))`.
 *   2. First row of a group defines header fields; subsequent rows MUST
 *      match (partyName, partyPhone, totals). Mismatch → ERROR
 *      `HEADER_MISMATCH_WITHIN_INVOICE` (AUDIT S1) on the group; lines
 *      keep accumulating so the row-count stays accurate, but the group
 *      will not be staged.
 *   3. Cap lines per group at `LINES_PER_INVOICE_CAP` (§7 row 13). The
 *      (cap+1)th line emits `LINES_PER_INVOICE_EXCEEDED` and STOPS
 *      accumulation for that group.
 *   4. Rows with no `invoiceNumber` or invalid date are sidelined as
 *      single-row groups carrying the per-row issue so the preview
 *      surfaces them under the source row index.
 *
 * The aggregator does NOT touch tax math, FK resolution, or amount
 * narrowing — those run in `normalizer.ts` AFTER aggregation.
 */

import { LINES_PER_INVOICE_CAP } from './invoice.constants.js'
import { parseInvoiceDate } from './date-parser.util.js'
import { headerEqual, headerFromRow, lineFromRow } from './aggregator-helpers.js'
import type { InvoiceIssue } from './invoice.types.js'
import type {
  RawInvoiceGroup,
  RawInvoiceLineRow,
} from './parsers/parser.types.js'

export interface AggregatedInvoiceGroup {
  /** Flat source index of the FIRST row of this invoice. */
  sourceIndex: number
  /** Lowercased + trimmed key — `${invoiceNumber}|${iso(date)}`. */
  key: string
  /** Header fields (from first matching row). */
  header: RawInvoiceGroup['header']
  /** Aggregated lines (capped at LINES_PER_INVOICE_CAP). */
  lines: RawInvoiceGroup['lines']
  /** Aggregator-emitted issues (header mismatch, lines cap, etc.). */
  issues: InvoiceIssue[]
  /** Parsed ISO date — pre-validated by aggregator. */
  isoDate: string | null
}

export interface AggregateInput {
  /** Set when parser emitted pre-aggregated groups (Tally). */
  preAggregatedGroups?: RawInvoiceGroup[]
  /** Set when parser emitted flat rows (CSV / XLSX). */
  rows?: RawInvoiceLineRow[]
}

export function aggregateInvoiceRows(
  input: AggregateInput,
): AggregatedInvoiceGroup[] {
  // Tally short-circuit: groups are already final. We still run the
  // date parser to convert Tally's date format to ISO, AND we still
  // enforce the lines cap.
  if (input.preAggregatedGroups) {
    return input.preAggregatedGroups.map<AggregatedInvoiceGroup>((g) => {
      const parsed = g.header.invoiceDate
        ? parseInvoiceDate(g.header.invoiceDate)
        : { ok: false as const, code: 'INVALID_DATE' as const }
      const issues: InvoiceIssue[] = []
      let iso: string | null = null
      if (parsed.ok) {
        iso = parsed.iso
      } else {
        issues.push({
          field: 'invoiceDate',
          code: 'INVALID_DATE',
          severity: 'ERROR',
          message: `Date '${g.header.invoiceDate ?? ''}' is unclear — use DD/MM/YYYY`,
        })
      }
      let lines = g.lines
      if (lines.length > LINES_PER_INVOICE_CAP) {
        issues.push({
          field: null,
          code: 'LINES_PER_INVOICE_EXCEEDED',
          severity: 'ERROR',
          message:
            `Invoice has ${lines.length} lines — split into smaller invoices ` +
            `(cap ${LINES_PER_INVOICE_CAP}).`,
        })
        lines = lines.slice(0, LINES_PER_INVOICE_CAP)
      }
      const key = iso
        ? `${(g.header.invoiceNumber ?? '').trim().toLowerCase()}|${iso}`
        : `__bad__|${g.sourceIndex}`
      return {
        sourceIndex: g.sourceIndex,
        key,
        header: { ...g.header, invoiceDate: iso ?? g.header.invoiceDate },
        lines,
        issues,
        isoDate: iso,
      }
    })
  }

  const rows = input.rows ?? []
  const groups = new Map<string, AggregatedInvoiceGroup>()
  const ordered: AggregatedInvoiceGroup[] = []

  for (const row of rows) {
    const number = row.invoiceNumber?.trim() ?? ''
    if (!number) {
      ordered.push(badGroup(row, {
        field: 'invoiceNumber',
        code: 'INVOICE_NUMBER_REQUIRED',
        severity: 'ERROR',
        message: 'Invoice number is required.',
      }))
      continue
    }
    const parsed = parseInvoiceDate(row.invoiceDate ?? '')
    if (!parsed.ok) {
      ordered.push(badGroup(row, {
        field: 'invoiceDate',
        code: 'INVALID_DATE',
        severity: 'ERROR',
        message: `Date '${row.invoiceDate ?? ''}' is unclear — use DD/MM/YYYY`,
      }))
      continue
    }
    const key = `${number.toLowerCase()}|${parsed.iso}`
    let g = groups.get(key)
    if (!g) {
      g = {
        sourceIndex: row.sourceIndex,
        key,
        header: headerFromRow(row, parsed.iso),
        lines: [],
        issues: [],
        isoDate: parsed.iso,
      }
      groups.set(key, g)
      ordered.push(g)
    } else {
      const cmp = headerEqual(g.header, row)
      if (!cmp.ok) {
        // Only push the issue once per group.
        const already = g.issues.some(
          (i) => i.code === 'HEADER_MISMATCH_WITHIN_INVOICE',
        )
        if (!already) {
          g.issues.push({
            field: cmp.field,
            code: 'HEADER_MISMATCH_WITHIN_INVOICE',
            severity: 'ERROR',
            message:
              `Header field '${cmp.field}' differs across lines of invoice ` +
              `'${number}'`,
          })
        }
      }
    }
    // Enforce lines cap.
    if (g.lines.length >= LINES_PER_INVOICE_CAP) {
      const already = g.issues.some(
        (i) => i.code === 'LINES_PER_INVOICE_EXCEEDED',
      )
      if (!already) {
        g.issues.push({
          field: null,
          code: 'LINES_PER_INVOICE_EXCEEDED',
          severity: 'ERROR',
          message:
            `Invoice '${number}' exceeded ${LINES_PER_INVOICE_CAP} lines — ` +
            'split into smaller invoices.',
        })
      }
      continue
    }
    g.lines.push(lineFromRow(row))
  }
  return ordered
}

function badGroup(
  row: RawInvoiceLineRow,
  issue: InvoiceIssue,
): AggregatedInvoiceGroup {
  return {
    sourceIndex: row.sourceIndex,
    key: `__bad__|${row.sourceIndex}`,
    header: headerFromRow(row, row.invoiceDate ?? ''),
    lines: [lineFromRow(row)],
    issues: [issue],
    isoDate: null,
  }
}
