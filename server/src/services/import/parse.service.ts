/**
 * Phase 7 — Import Engine · Parse + stage service (API.5)
 *
 * Drives the parser → normalizer → dedup pipeline and persists one
 * `ImportJobRow` per source row. On success the job transitions to
 * PREVIEWED with a freshly-minted `commitToken` (S11: crypto.randomUUID).
 *
 * Sync vs async — `runParseAndStage` is invoked synchronously by the
 * upload route when `rowCount <= SYNC_PARSE_CAP`; for larger files the
 * route fires `setImmediate(() => runParseAndStage(...))` and returns 202
 * with status='PARSING'. Errors in the async path land in `status='FAILED'`
 * via the catch arm here.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §6.2 / §7
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S11 (token entropy)
 */

// PII: logger calls MUST NOT include raw cell content — only jobId,
// sourceIndex, code, field (S9).
import crypto from 'node:crypto'
import { ParseError } from './parsers/index.js'
import { emitParsed, emitRowDropped } from './audit-emit.js'
import type { ColumnMapping } from './normalizers/normalize-mappings.js'
import type { ProductColumnMapping } from './normalizers/product-mappings.js'
import {
  buildStagedPartyRows,
  resolvePartyMapping,
  type StagedPartyRow,
} from './party-parse.helper.js'
import {
  buildStagedProductRows,
  resolveProductMapping,
  type StagedProductRow,
} from './product-parse.helper.js'
import type {
  AuthContext,
  ImportFormat,
} from '../../types/import.types.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

const ROW_INSERT_CHUNK = 500

export interface ParseAndStageArgs {
  jobId: string
  buffer: Buffer
  format: ImportFormat
  /** Required for GENERIC_CSV; ignored for the three known formats. */
  mapping?: ColumnMapping
  /** Phase 7 · 7.1B — product mapping (used when entity='product'). */
  productMapping?: ProductColumnMapping
  fileName?: string
  /** Phase 7 · 7.1B — discriminates parties vs product pipelines. */
  entity?: 'parties' | 'product'
  auth: AuthContext
  prisma: ExtendedPrismaClient
}

export interface ParseAndStageResult {
  rowCount: number
  errorCount: number
  commitToken: string
}

// Mapping / staging / classification live in party-parse.helper.ts and
// product-parse.helper.ts. parse.service.ts orchestrates only.

/**
 * End-to-end parse → normalize → dedup → stage → PREVIEWED.
 * On `ParseError` the job lands in FAILED with reason in `counts.failedReason`.
 */
export async function runParseAndStage(
  args: ParseAndStageArgs,
): Promise<ParseAndStageResult> {
  const {
    jobId,
    buffer,
    format,
    mapping,
    productMapping,
    fileName,
    entity = 'parties',
    auth,
    prisma,
  } = args
  const startedAt = Date.now()

  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'PARSING' },
  })

  let staged: StagedPartyRow[] | StagedProductRow[]
  try {
    if (entity === 'product') {
      staged = await buildStagedProductRows({
        buffer,
        format,
        mapping: resolveProductMapping(format, productMapping),
        fileName,
        businessId: auth.businessId,
        prisma,
      })
    } else {
      staged = await buildStagedPartyRows({
        buffer,
        format,
        mapping: resolvePartyMapping(format, mapping),
        fileName,
        businessId: auth.businessId,
        prisma,
      })
    }
  } catch (err) {
    const code = err instanceof ParseError ? err.code : 'MALFORMED'
    const message = err instanceof Error ? err.message : 'parse failed'
    logger.warn('import.parse.failed', { jobId, code })
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        counts: { failedReason: code, message },
      },
    })
    throw err
  }

  // Treat both union arms structurally — both expose status/raw/normalized.
  const stagedAny = staged as Array<{
    sourceIndex: number
    status: 'STAGED' | 'ERROR' | 'SKIPPED'
    raw: Record<string, string>
    normalized: { issues?: unknown } & Record<string, unknown>
    matchedPartyId?: string
  }>
  const errorCount = stagedAny.filter((r) => r.status === 'ERROR').length
  const stagedCount = stagedAny.length - errorCount

  // Bulk insert in chunks of 500 — Prisma createMany takes Json natively.
  for (let i = 0; i < stagedAny.length; i += ROW_INSERT_CHUNK) {
    const chunk = stagedAny.slice(i, i + ROW_INSERT_CHUNK)
    await prisma.importJobRow.createMany({
      data: chunk.map((r) => ({
        jobId,
        sourceIndex: r.sourceIndex,
        status: r.status,
        raw: r.raw as object,
        normalized: r.normalized as unknown as object,
        issues: (r.normalized.issues ?? []) as unknown as object,
        matchedPartyId: r.matchedPartyId ?? null,
      })),
      skipDuplicates: true,
    })
  }

  // S11 — commitToken must be unguessable. crypto.randomUUID is 122-bit
  // RFC 4122 v4; fits the 20-40 char zod constraint (36 chars).
  const commitToken = crypto.randomUUID()
  const durationMs = Date.now() - startedAt
  await prisma.$transaction(async (tx) => {
    await tx.importJob.update({
      where: { id: jobId },
      data: {
        status: 'PREVIEWED',
        rowCount: stagedAny.length,
        errorCount,
        commitToken,
        counts: {
          total: stagedAny.length,
          staged: stagedCount,
          errors: errorCount,
        },
      },
    })
    await emitParsed(tx, auth, {
      jobId,
      rowCount: stagedAny.length,
      errorCount,
      durationMs,
    })
    // Per-row drop audits — code/field only, no raw cell content (S9).
    for (const r of stagedAny) {
      if (r.status !== 'ERROR') continue
      const issues = Array.isArray(r.normalized.issues)
        ? (r.normalized.issues as Array<{ code?: string; field?: string }>)
        : []
      const first = issues[0]
      await emitRowDropped(tx, auth, {
        jobId,
        sourceIndex: r.sourceIndex,
        code: first?.code ?? 'UNKNOWN',
        field: first?.field,
      })
    }
  })
  logger.info('import.parse.previewed', {
    jobId,
    rowCount: stagedAny.length,
    errorCount,
    durationMs,
  })
  return { rowCount: stagedAny.length, errorCount, commitToken }
}
