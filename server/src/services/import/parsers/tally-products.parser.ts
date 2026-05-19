/**
 * Phase 7 · 7.1B — Tally STOCKITEM parser
 *
 * Extracts `<STOCKITEM>` blocks from a Tally XML export and emits
 * RawProductRow[]. Reuses the same XXE pre-scan + processEntities:false
 * + 10s race timeout envelope as tally-xml.parser.ts (parties).
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1B.md §5 (Tally STOCKITEM table)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S2 (fast-xml-parser pin)
 */

import { XMLParser } from 'fast-xml-parser'
import { scanForXxe } from '../security/xxe-prescan.js'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
} from '../../../constants/import.constants.js'
import type {
  RawProductRow,
  ParserResult,
} from '../../../types/import.types.js'
import {
  ParseError,
  withTimeout,
  type ParserContext,
} from './parser.types.js'

interface TallyStockItemNode {
  '@_NAME'?: string
  ALIAS?: string | string[]
  HSNCODE?: string
  HSNNUMBER?: string
  BASEUNITS?: string
  OPENINGBALANCE?: string
  OPENINGRATE?: string
  STANDARDPRICE?: string
  MRP?: string
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

function itemToRow(node: TallyStockItemNode, index: number): RawProductRow | null {
  const name = asString(node['@_NAME'])
  if (!name) return null
  const raw: Record<string, string> = { name }
  const sku = asString(node.ALIAS)
  if (sku) raw.sku = sku
  const hsn = asString(node.HSNCODE) || asString(node.HSNNUMBER)
  if (hsn) raw.hsn = hsn
  const unit = asString(node.BASEUNITS)
  if (unit) raw.unit = unit
  const opening = asString(node.OPENINGBALANCE)
  if (opening) raw.openingStock = opening
  const purchase = asString(node.OPENINGRATE)
  if (purchase) raw.purchasePrice = purchase
  const sale = asString(node.STANDARDPRICE)
  if (sale) raw.salePrice = sale
  const mrp = asString(node.MRP)
  if (mrp && mrp !== '0') raw.mrp = mrp
  return { sourceIndex: index, raw }
}

function extractStockItems(parsed: unknown): TallyStockItemNode[] {
  const found: unknown[] = []
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    const obj = n as Record<string, unknown>
    if ('STOCKITEM' in obj) {
      const v = obj.STOCKITEM
      if (Array.isArray(v)) found.push(...v)
      else found.push(v)
    }
    for (const k of Object.keys(obj)) {
      if (k === 'STOCKITEM') continue
      walk(obj[k])
    }
  }
  walk(parsed)
  return found.filter((c): c is TallyStockItemNode => !!c && typeof c === 'object')
}

export async function tallyProductsParser(
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
          `tally stockitem parse failed: ${(e as Error).message}`,
        )
      }
    }),
    PARSE_TIMEOUT_MS,
    'tally-products',
  )
  const items = extractStockItems(parsed)
  const rows: RawProductRow[] = []
  for (let i = 0; i < items.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError('FILE_TOO_LARGE', `row count exceeded MAX_ROWS=${MAX_ROWS}`)
    }
    const row = itemToRow(items[i] as TallyStockItemNode, rows.length)
    if (row) rows.push(row)
  }
  // ParserResult is defined against RawPartyRow; cast at the boundary
  // — caller dispatch picks the right shape via `(format, entity)`.
  return {
    rows: rows as unknown as ParserResult['rows'],
    rowCount: rows.length,
    rejectedCount: 0,
  }
}
