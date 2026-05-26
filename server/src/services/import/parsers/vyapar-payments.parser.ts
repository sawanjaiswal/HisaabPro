/**
 * Phase 7 · 7.1D PR-D2b — Vyapar payments CSV parser.
 *
 * Vyapar exports payments with a variable header set (EN, often
 * Devanagari on bilingual installs). We auto-detect columns via
 * `payment-column-dict.constants.ts`'s frozen-Map alias dictionary —
 * M12-clean lookup. CSV-injection defence lives downstream in the
 * normalizer.
 *
 * Authority:
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md §8 (L416-429)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §4 row vyapar-csv.parser.ts
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

/**
 * Build a per-file map from source-header → canonical key. Two
 * source headers that map to the same canonical key collapse onto the
 * first hit (deterministic, header-order wins).
 */
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
  // Iterate the headerMap (not Object.keys(record)) so we only project
  // known-canonical columns and silently ignore unrecognised headers.
  for (const [source, canonical] of headerMap) {
    const v = record[source]
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (!trimmed) continue
    raw[canonical] = trimmed
    hasContent = true
  }
  if (!hasContent) return null
  return { sourceIndex: index, raw }
}

export async function vyaparPaymentsParser(
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
            `vyapar payments csv parse failed: ${fatal.message}`,
          )
        }
      }
      return { data: r.data, fields: r.meta?.fields ?? [] }
    }),
    PARSE_TIMEOUT_MS,
    'vyapar-payments',
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
