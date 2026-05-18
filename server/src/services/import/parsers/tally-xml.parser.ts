/**
 * Phase 7 — Import Engine · Tally XML parser
 *
 * Parses a Tally ledger export and emits `RawPartyRow[]`. Tally writes
 * one `<LEDGER>` per master with a sibling `<TALLYMESSAGE>` wrapper;
 * we keep only ledgers whose `<PARENT>` is "Sundry Debtors" or
 * "Sundry Creditors" (party-style accounts).
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S2 — fast-xml-parser ≥ 4.4.0
 *     (CVE-2024-41818). Version pin verified at boot via constants.
 *   - ARCHITECTURE §4.2 — pre-scan runs BEFORE parser instantiation.
 */

import { XMLParser } from 'fast-xml-parser'
import { scanForXxe } from '../security/xxe-prescan.js'
import {
  PARSE_TIMEOUT_MS,
  MAX_ROWS,
} from '../../../constants/import.constants.js'
import type {
  RawPartyRow,
  ParserResult,
} from '../../../types/import.types.js'
import {
  ParseError,
  withTimeout,
  type ParserContext,
} from './parser.types.js'

// Tally party-style account categories. Other PARENT values (Indirect
// Expenses, Bank Accounts, etc.) are skipped — they aren't customers
// or suppliers and shouldn't end up in the parties table.
const PARTY_PARENTS = new Set([
  'sundry debtors',
  'sundry creditors',
])

interface TallyLedgerNode {
  // fast-xml-parser preserves casing of source XML; Tally exports
  // uppercase tag names, so all reads use the @_ form for attributes
  // and bare names for child text nodes.
  '@_NAME'?: string
  PARENT?: string | { '#text'?: string }
  LEDPHONE?: string
  PHONE?: string
  EMAIL?: string
  INCOMETAXNUMBER?: string
  GSTREGNUMBER?: string
  LEDMAILINGADDRESS?: string | string[]
  ADDRESS?: string | string[]
  OPENINGBALANCE?: string
}

function asString(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.map(asString).filter(Boolean).join(', ')
  if (typeof v === 'object') {
    const t = (v as { '#text'?: unknown })['#text']
    return t === undefined ? '' : asString(t)
  }
  return ''
}

function isPartyLedger(parent: string): boolean {
  return PARTY_PARENTS.has(parent.trim().toLowerCase())
}

function ledgerToRow(
  node: TallyLedgerNode,
  index: number,
): RawPartyRow | null {
  const name = asString(node['@_NAME'])
  if (!name) return null
  const parent = asString(node.PARENT)
  if (!isPartyLedger(parent)) return null

  const raw: Record<string, string> = { name, parent }
  const phone = asString(node.LEDPHONE) || asString(node.PHONE)
  if (phone) raw.phone = phone
  const email = asString(node.EMAIL)
  if (email) raw.email = email
  const gstin = asString(node.GSTREGNUMBER) || asString(node.INCOMETAXNUMBER)
  if (gstin) raw.gstin = gstin
  const addr = asString(node.LEDMAILINGADDRESS) || asString(node.ADDRESS)
  if (addr) raw.address = addr
  const opening = asString(node.OPENINGBALANCE)
  if (opening) raw.openingBalance = opening

  return { sourceIndex: index, raw }
}

function extractLedgers(parsed: unknown): TallyLedgerNode[] {
  // Tally export shape: ENVELOPE > BODY > IMPORTDATA > REQUESTDATA >
  // TALLYMESSAGE[] > LEDGER. We accept either nested or flat shapes
  // (some exports skip the IMPORTDATA wrapper).
  const root = parsed as Record<string, unknown> | undefined
  if (!root) return []

  const candidates: unknown[] = []
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) {
      n.forEach(walk)
      return
    }
    const obj = n as Record<string, unknown>
    if ('LEDGER' in obj) {
      const led = obj.LEDGER
      if (Array.isArray(led)) candidates.push(...led)
      else candidates.push(led)
    }
    for (const k of Object.keys(obj)) {
      if (k === 'LEDGER') continue
      walk(obj[k])
    }
  }
  walk(root)
  return candidates.filter(
    (c): c is TallyLedgerNode => !!c && typeof c === 'object',
  )
}

export async function tallyXmlParser(
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
          `tally xml parse failed: ${(e as Error).message}`,
        )
      }
    }),
    PARSE_TIMEOUT_MS,
    'tally-xml',
  )

  const ledgers = extractLedgers(parsed)
  const rows: RawPartyRow[] = []
  for (let i = 0; i < ledgers.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      throw new ParseError(
        'FILE_TOO_LARGE',
        `row count exceeded MAX_ROWS=${MAX_ROWS}`,
      )
    }
    const row = ledgerToRow(ledgers[i] as TallyLedgerNode, rows.length)
    if (row) rows.push(row)
  }

  return {
    rows,
    rowCount: rows.length,
    rejectedCount: 0,
  }
}
