/**
 * Phase 7 · 7.1C — Tally Sales-voucher XML parser.
 *
 * Walks `<VOUCHER VCHTYPE="Sales">` blocks; each one is a complete
 * invoice — header on the voucher, line items nested under
 * `<ALLINVENTORYENTRIES.LIST>`. Aggregation is implicit: one VOUCHER
 * = one invoice, so this parser sets `preAggregated: true`.
 *
 * Envelope mirrors `tally-xml.parser.ts` / `tally-products.parser.ts`:
 *   - XXE pre-scan (no DOCTYPE, no ENTITY)
 *   - fast-xml-parser with `processEntities:false`
 *   - 10s race timeout via `withTimeout`
 *
 * Tally non-Sales vouchers (Purchase, Journal, Payment) are skipped.
 */

import { XMLParser } from 'fast-xml-parser'
import { scanForXxe } from '../../security/xxe-prescan.js'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
} from '../../../../constants/import.constants.js'
import {
  ParseError,
  withTimeout,
  type InvoiceParser,
  type InvoiceParserResult,
  type RawInvoiceGroup,
} from './parser.types.js'

interface TallyInventoryEntry {
  STOCKITEMNAME?: string | { '#text'?: string }
  ALIAS?: string | string[]
  RATE?: string
  ACTUALQTY?: string
  BILLEDQTY?: string
  AMOUNT?: string
  DISCOUNT?: string
}

interface TallyLedgerEntry {
  LEDGERNAME?: string | { '#text'?: string }
  AMOUNT?: string
  ISDEEMEDPOSITIVE?: string
}

interface TallyVoucher {
  '@_VCHTYPE'?: string
  VOUCHERNUMBER?: string | { '#text'?: string }
  DATE?: string
  PARTYLEDGERNAME?: string | { '#text'?: string }
  PARTYNAME?: string | { '#text'?: string }
  BASICBUYERSALESTAXNUMBER?: string
  PARTYGSTIN?: string
  NARRATION?: string
  REFERENCEDATE?: string
  'ALLINVENTORYENTRIES.LIST'?: TallyInventoryEntry | TallyInventoryEntry[]
  'LEDGERENTRIES.LIST'?: TallyLedgerEntry | TallyLedgerEntry[]
}

function asString(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return asString(v[0])
  if (typeof v === 'object') {
    const t = (v as { '#text'?: unknown })['#text']
    return t === undefined ? '' : asString(t)
  }
  return ''
}

function nz(s: string): string | null {
  return s.length > 0 ? s : null
}

function extractVouchers(parsed: unknown): TallyVoucher[] {
  const found: unknown[] = []
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    const obj = n as Record<string, unknown>
    if ('VOUCHER' in obj) {
      const v = obj.VOUCHER
      if (Array.isArray(v)) found.push(...v)
      else found.push(v)
    }
    for (const k of Object.keys(obj)) {
      if (k === 'VOUCHER') continue
      walk(obj[k])
    }
  }
  walk(parsed)
  return found.filter((c): c is TallyVoucher => !!c && typeof c === 'object')
}

function sumLedgerTax(
  ledgers: TallyLedgerEntry[],
  needle: string,
): string | null {
  // Tally records taxes as ledger entries named "CGST", "Output CGST",
  // "CGST 9%", etc. Sum amounts whose ledger name contains the needle.
  let total = 0
  let found = false
  for (const led of ledgers) {
    const name = asString(led.LEDGERNAME).toLowerCase()
    if (!name.includes(needle.toLowerCase())) continue
    const amt = Number(asString(led.AMOUNT))
    if (Number.isFinite(amt)) {
      // Tally stores tax amounts as negative (credit); we use absolute.
      total += Math.abs(amt)
      found = true
    }
  }
  return found ? total.toFixed(2) : null
}

function voucherToGroup(
  v: TallyVoucher,
  index: number,
): RawInvoiceGroup | null {
  const vchType = asString(v['@_VCHTYPE']).toLowerCase()
  if (vchType !== 'sales') return null
  const invoiceNumber = nz(asString(v.VOUCHERNUMBER))
  if (!invoiceNumber) return null
  const invoiceDate = nz(asString(v.DATE)) // Tally uses YYYYMMDD or DD-Mon-YYYY
  const partyName = nz(asString(v.PARTYLEDGERNAME) || asString(v.PARTYNAME))
  const partyGstin = nz(asString(v.PARTYGSTIN))

  const invListRaw = v['ALLINVENTORYENTRIES.LIST']
  const invList: TallyInventoryEntry[] = invListRaw
    ? Array.isArray(invListRaw) ? invListRaw : [invListRaw]
    : []

  const ledListRaw = v['LEDGERENTRIES.LIST']
  const ledList: TallyLedgerEntry[] = ledListRaw
    ? Array.isArray(ledListRaw) ? ledListRaw : [ledListRaw]
    : []

  const totalCgst = sumLedgerTax(ledList, 'cgst')
  const totalSgst = sumLedgerTax(ledList, 'sgst')
  const totalIgst = sumLedgerTax(ledList, 'igst')

  const lines = invList.map((inv) => ({
    sku: nz(asString(inv.ALIAS)),
    productName: nz(asString(inv.STOCKITEMNAME)),
    qty: nz(asString(inv.BILLEDQTY) || asString(inv.ACTUALQTY)),
    unit: null,
    rate: nz(asString(inv.RATE)),
    discount: nz(asString(inv.DISCOUNT)),
    taxableValue: null,
    cgst: null,
    sgst: null,
    igst: null,
    lineTotal: nz(asString(inv.AMOUNT)),
  }))

  return {
    sourceIndex: index,
    header: {
      invoiceNumber,
      invoiceDate,
      partyName,
      partyPhone: null,
      partyGstin,
      subtotal: null,
      totalCgst,
      totalSgst,
      totalIgst,
      grandTotal: null, // Tally doesn't store one; aggregator computes via reconcile
      notes: nz(asString(v.NARRATION)),
    },
    lines,
  }
}

export const tallyVoucherParser: InvoiceParser = async (
  buffer,
  _ctx,
): Promise<InvoiceParserResult> => {
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
          `tally voucher xml parse failed: ${(e as Error).message}`,
        )
      }
    }),
    PARSE_TIMEOUT_MS,
    'tally-voucher',
  )
  const vouchers = extractVouchers(parsed)
  const groups: RawInvoiceGroup[] = []
  let lineCount = 0
  for (let i = 0; i < vouchers.length; i += 1) {
    const g = voucherToGroup(vouchers[i] as TallyVoucher, groups.length)
    if (!g) continue
    lineCount += g.lines.length
    if (lineCount > MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `line count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    groups.push(g)
  }
  return {
    preAggregated: true,
    rows: [],
    groups,
    rowCount: lineCount,
  }
}

// Re-exported for tests that want to assert on the line-projection.
export const __internal = { extractVouchers, voucherToGroup }
