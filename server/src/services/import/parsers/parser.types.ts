/**
 * Phase 7 — Import Engine · Parser shared interface
 *
 * Every format-specific parser implements `PartyParser`. The dispatcher
 * (`index.ts`) picks one by `ImportFormat`. Parsers are pure functions
 * (no DB, no Prisma) so they unit-test with inline fixtures.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §4 (parser architecture)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S2 / S10 (lib pins, byte caps)
 */

import type { ImportFormat, ParserResult } from '../../../types/import.types.js'

export interface ParserContext {
  format: ImportFormat
  fileName?: string
}

export type PartyParser = (
  buffer: Buffer,
  ctx: ParserContext,
) => Promise<ParserResult>

export type ParseErrorCode =
  | 'UNSAFE_XML'
  | 'UNSAFE_ARCHIVE'
  | 'PARSE_TIMEOUT'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'EMPTY_FILE'
  | 'MALFORMED'

export class ParseError extends Error {
  public readonly code: ParseErrorCode
  constructor(code: ParseErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'ParseError'
  }
}

/** Shared timeout helper — rejects with ParseError('PARSE_TIMEOUT'). */
export function withTimeout<T>(
  task: Promise<T>,
  ms: number,
  label = 'parse',
): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ParseError('PARSE_TIMEOUT', `${label} exceeded ${ms}ms`))
    }, ms)
  })
  return Promise.race([task, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}
