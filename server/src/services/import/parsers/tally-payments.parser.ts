/**
 * Phase 7 · 7.1D PR-D2b — Tally Receipt-voucher XML parser.
 *
 * Walks `<VOUCHER VCHTYPE="Receipt">` blocks and emits one
 * `RawPaymentRow` per voucher. Security envelope mirrors the existing
 * Tally parsers: XXE pre-scan + `processEntities:false` + 10s race
 * timeout. Voucher walking helpers live in `tally-payments.helpers.ts`
 * to keep this file under the 250-LOC cap.
 *
 * Mapping (SCOPE §8 L378-414):
 *   - partyName       ← PARTYLEDGERNAME
 *   - partyPhone      ← first 10-digit numeric in PARTYMAILINGADDRESS.LIST
 *   - amount          ← |Σ bank/cash leg AMOUNTs| (debit-side / negative)
 *   - mode            ← bank-leg LEDGERNAME (resolved downstream)
 *   - referenceNumber ← <CHEQUENO>
 *   - invoiceNumber   ← BILLALLOCATIONS.LIST/NAME (multi → comma-joined)
 *   - date            ← DATE attribute, pre-formatted via tallyPreformatDate
 *
 * Authority:
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md L378-414
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §4
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1 M13 (date pre-format)
 */

import { XMLParser } from 'fast-xml-parser'
import { scanForXxe } from '../security/xxe-prescan.js'
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
  extractReceiptVouchers,
  voucherToRow,
  type TallyReceiptVoucher,
} from './tally-payments.helpers.js'

export async function tallyPaymentsParser(
  buffer: Buffer,
  _ctx: ParserContext,
): Promise<ParserResult> {
  if (!buffer || buffer.length === 0) {
    throw new ParseError('EMPTY_FILE', 'XML buffer is empty')
  }
  const scan = scanForXxe(buffer)
  if (!scan.safe) {
    throw new ParseError('UNSAFE_XML', 'XML pre-scan rejected the file')
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    allowBooleanAttributes: false,
    ignoreDeclaration: true,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  })
  const parsed = await withTimeout(
    Promise.resolve().then(() => {
      try {
        return parser.parse(buffer.toString('utf8'))
      } catch (e) {
        throw new ParseError(
          'MALFORMED',
          `tally receipt parse failed: ${(e as Error).message}`,
        )
      }
    }),
    PARSE_TIMEOUT_MS,
    'tally-payments',
  )
  const vouchers = extractReceiptVouchers(parsed)
  const rows: RawPaymentRow[] = []
  for (let i = 0; i < vouchers.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = voucherToRow(vouchers[i] as TallyReceiptVoucher, rows.length)
    if (row) rows.push(row)
  }
  return {
    rows: rows as unknown as ParserResult['rows'],
    rowCount: rows.length,
    rejectedCount: 0,
  }
}
