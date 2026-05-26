/**
 * Phase 7 · 7.1D PR-D2b — Generic payments CSV parser.
 *
 * Auto-detects columns via the shared payment-column-dict. If zero
 * canonical keys are detected the parser still returns the rows
 * un-projected (verbatim header keys preserved) so the FE's column
 * mapper can surface the user-driven mapping UI later (PR-D5 territory).
 * In that case we forward original headers under `raw[<header>]` — the
 * downstream normalizer treats the absence of `raw.date`/`raw.amount`
 * as `MAPPING_REQUIRED`.
 *
 * Authority:
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md §8 (L442-447)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §4 row generic-csv.parser.ts
 */

import Papa from 'papaparse'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
} from '../../../constants/import.constants.js'
import type {
  RawPaymentRow,
  ParserResult,
} from '../../../types/import.types.js'
import {
  ParseError,
  withTimeout,
  type ParserContext,
} from './parser.types.js'
import {
  resolveHeader,
  type PaymentCanonicalKey,
} from './payment-column-dict.constants.js'

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function buildHeaderMap(
  headers: string[],
): Map<string, PaymentCanonicalKey> {
  const m = new Map<string, PaymentCanonicalKey>()
  const seen = new Set<PaymentCanonicalKey>()
  for (const h of headers) {
    if (!h) continue
    const canonical = resolveHeader(h)
    if (canonical === null) continue
    if (seen.has(canonical)) continue
    m.set(h, canonical)
    seen.add(canonical)
  }
  return m
}

function recordToRow(
  record: Record<string, string>,
  headerMap: Map<string, PaymentCanonicalKey>,
  index: number,
): RawPaymentRow | null {
  const raw: Record<string, string> = {}
  let hasContent = false
  if (headerMap.size > 0) {
    for (const [source, canonical] of headerMap) {
      const v = record[source]
      if (typeof v !== 'string') continue
      const trimmed = v.trim()
      if (!trimmed) continue
      raw[canonical] = trimmed
      hasContent = true
    }
  } else {
    // Zero canonical headers detected — surface raw headers so the
    // downstream mapping UI can show them. Normalizer treats this as
    // MAPPING_REQUIRED (missing date/amount).
    for (const key of Object.keys(record)) {
      if (!key) continue
      const v = record[key]
      if (typeof v !== 'string') continue
      const trimmed = v.trim()
      if (!trimmed) continue
      raw[key] = trimmed
      hasContent = true
    }
  }
  if (!hasContent) return null
  return { sourceIndex: index, raw }
}

export async function genericPaymentsParser(
  buffer: Buffer,
  _ctx: ParserContext,
): Promise<ParserResult> {
  if (!buffer || buffer.length === 0) {
    throw new ParseError('EMPTY_FILE', 'CSV buffer is empty')
  }
  const text = stripBom(buffer.toString('utf8'))
  const parsed = await withTimeout(
    Promise.resolve().then(() => {
      const r = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => stripBom(h).trim(),
      })
      if (r.errors && r.errors.length > 0) {
        const fatal = r.errors.find((e) => e.type === 'Delimiter')
        if (fatal) {
          throw new ParseError(
            'MALFORMED',
            `generic payments csv parse failed: ${fatal.message}`,
          )
        }
      }
      return { data: r.data, fields: r.meta?.fields ?? [] }
    }),
    PARSE_TIMEOUT_MS,
    'generic-payments',
  )
  const headerMap = buildHeaderMap(parsed.fields)
  const rows: RawPaymentRow[] = []
  for (let i = 0; i < parsed.data.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = recordToRow(
      parsed.data[i] as Record<string, string>,
      headerMap,
      rows.length,
    )
    if (row) rows.push(row)
  }
  return {
    rows: rows as unknown as ParserResult['rows'],
    rowCount: rows.length,
    rejectedCount: 0,
  }
}
