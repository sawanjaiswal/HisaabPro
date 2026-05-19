/**
 * Phase 7 — Import Engine · Parser dispatcher
 *
 * Picks the right format-specific parser by `ctx.format` and returns
 * its `ParserResult`. Service layer (API.5) holds the only call site.
 */

import type { ImportFormat, ParserResult } from '../../../types/import.types.js'
import { tallyXmlParser } from './tally-xml.parser.js'
import { vyaparCsvParser } from './vyapar-csv.parser.js'
import { busyXlsxParser } from './busy-xlsx.parser.js'
import { genericCsvParser } from './generic-csv.parser.js'
import { tallyProductsParser } from './tally-products.parser.js'
import { vyaparProductsParser } from './vyapar-products.parser.js'
import { busyProductsParser } from './busy-products.parser.js'
import { genericProductsParser } from './generic-products.parser.js'
import {
  ParseError,
  type ParserContext,
  type PartyParser,
} from './parser.types.js'

export type ImportEntity = 'parties' | 'product'

const partyParsers: Record<ImportFormat, PartyParser> = {
  TALLY_XML: tallyXmlParser,
  VYAPAR_CSV: vyaparCsvParser,
  BUSY_XLSX: busyXlsxParser,
  GENERIC_CSV: genericCsvParser,
}

const productParsers: Record<ImportFormat, PartyParser> = {
  TALLY_XML: tallyProductsParser,
  VYAPAR_CSV: vyaparProductsParser,
  BUSY_XLSX: busyProductsParser,
  GENERIC_CSV: genericProductsParser,
}

export async function parseFile(
  buffer: Buffer,
  ctx: ParserContext,
  entity: ImportEntity = 'parties',
): Promise<ParserResult> {
  const table = entity === 'product' ? productParsers : partyParsers
  const fn = table[ctx.format]
  if (!fn) {
    throw new ParseError(
      'UNSUPPORTED_FORMAT',
      `no parser for format=${ctx.format} entity=${entity}`,
    )
  }
  return fn(buffer, ctx)
}

export { ParseError } from './parser.types.js'
export type { ParserContext, PartyParser } from './parser.types.js'
