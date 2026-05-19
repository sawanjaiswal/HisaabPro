/**
 * Phase 7 · 7.1C — Invoice parser dispatcher.
 *
 * Picks the right format-specific invoice parser. Mirrors
 * `../parsers/index.ts` (parties + products) but emits
 * `InvoiceParserResult` (one-shot flat rows + optional pre-aggregated
 * groups) instead of the parties/products `ParserResult` shape.
 */

import type { ImportFormat } from '../../../../types/import.types.js'
import { tallyVoucherParser } from './tally-voucher.parser.js'
import { vyaparInvoiceCsvParser } from './vyapar-csv.parser.js'
import { busyInvoiceXlsxParser } from './busy-xlsx.parser.js'
import { genericInvoiceCsvParser } from './generic-csv.parser.js'
import {
  ParseError,
  type InvoiceParser,
  type InvoiceParserResult,
  type ParserContext,
} from './parser.types.js'

const TABLE: Record<ImportFormat, InvoiceParser> = {
  TALLY_XML: tallyVoucherParser,
  VYAPAR_CSV: vyaparInvoiceCsvParser,
  BUSY_XLSX: busyInvoiceXlsxParser,
  GENERIC_CSV: genericInvoiceCsvParser,
}

export async function parseInvoiceFile(
  buffer: Buffer,
  ctx: ParserContext,
): Promise<InvoiceParserResult> {
  const fn = TABLE[ctx.format]
  if (!fn) {
    throw new ParseError(
      'UNSUPPORTED_FORMAT',
      `no invoice parser for format=${ctx.format}`,
    )
  }
  return fn(buffer, ctx)
}

export { ParseError }
export type { InvoiceParser, InvoiceParserResult, ParserContext }
