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
import { ParseError, parseFile } from './parsers/index.js'
import { emitParsed, emitRowDropped } from './audit-emit.js'
import { normalizePartyRow } from './normalizers/party-normalizer.js'
import {
  defaultMappingFor,
  type ColumnMapping,
} from './normalizers/normalize-mappings.js'
import { findExactDuplicates } from './dedup/exact-dedup.js'
import { findNearDuplicates } from './dedup/near-dedup.js'
import type {
  AuthContext,
  ImportFormat,
  NormalizedPartyRow,
  RawPartyRow,
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
  fileName?: string
  auth: AuthContext
  prisma: ExtendedPrismaClient
}

export interface ParseAndStageResult {
  rowCount: number
  errorCount: number
  commitToken: string
}

/**
 * Effective mapping = caller override (Generic CSV) OR format default.
 * Throws if Generic CSV is missing a mapping — that's a programmer bug,
 * the FE mapping page guarantees the body.
 */
function resolveMapping(
  format: ImportFormat,
  override: ColumnMapping | undefined,
): ColumnMapping {
  if (override) return override
  const fallback = defaultMappingFor(format)
  if (!fallback) {
    throw new Error(
      `parse: column mapping is required for format=${format}`,
    )
  }
  return fallback
}

interface StagedRow {
  sourceIndex: number
  status: 'STAGED' | 'ERROR' | 'SKIPPED'
  raw: RawPartyRow['raw']
  normalized: NormalizedPartyRow
  matchedPartyId?: string
}

function classifyRow(n: NormalizedPartyRow): 'STAGED' | 'ERROR' {
  // Name is the only hard requirement; anything else surfaces as a
  // warning chip on the preview but still gets staged for commit.
  const hasFatal = n.issues.some((i) => i.code === 'MISSING_NAME')
  return hasFatal ? 'ERROR' : 'STAGED'
}

/**
 * Internal: parse + normalize + dedup, returning the rows to be inserted
 * as ImportJobRow. Pure-ish (no DB writes except dedup reads via prisma).
 */
async function buildStagedRows(args: {
  buffer: Buffer
  format: ImportFormat
  mapping: ColumnMapping
  fileName?: string
  businessId: string
  prisma: ExtendedPrismaClient
}): Promise<StagedRow[]> {
  const { buffer, format, mapping, fileName, businessId, prisma } = args
  const parsed = await parseFile(buffer, { format, fileName })

  const normalised: Array<NormalizedPartyRow & { sourceIndex: number; raw: RawPartyRow['raw'] }> =
    parsed.rows.map((r) => ({
      sourceIndex: r.sourceIndex,
      raw: r.raw,
      ...normalizePartyRow(r, mapping),
    }))

  // Dedup — both passes scoped strictly by businessId.
  const [exact, near] = await Promise.all([
    findExactDuplicates({ businessId, rows: normalised, prisma }),
    findNearDuplicates({ businessId, rows: normalised, prisma }),
  ])

  return normalised.map((n) => {
    const exactHit = exact.get(n.sourceIndex)
    const nearHits = near.get(n.sourceIndex)
    const normalizedView: NormalizedPartyRow = {
      name: n.name,
      ...(n.phoneE164 ? { phoneE164: n.phoneE164 } : {}),
      ...(n.email ? { email: n.email } : {}),
      ...(n.gstin ? { gstin: n.gstin } : {}),
      ...(n.address ? { address: n.address } : {}),
      ...(n.openingBalancePaise !== undefined
        ? { openingBalancePaise: n.openingBalancePaise }
        : {}),
      issues: nearHits
        ? [
            ...n.issues,
            {
              field: 'name',
              code: 'NEAR_DUPLICATE',
              message: `Possibly matches existing party ${nearHits[0]!.name}`,
            },
          ]
        : n.issues,
    }
    const row: StagedRow = {
      sourceIndex: n.sourceIndex,
      status: classifyRow(n),
      raw: n.raw,
      normalized: normalizedView,
    }
    if (exactHit) row.matchedPartyId = exactHit.partyId
    return row
  })
}

/**
 * End-to-end parse → normalize → dedup → stage → PREVIEWED.
 * On `ParseError` the job lands in FAILED with reason in `counts.failedReason`.
 */
export async function runParseAndStage(
  args: ParseAndStageArgs,
): Promise<ParseAndStageResult> {
  const { jobId, buffer, format, mapping, fileName, auth, prisma } = args
  const startedAt = Date.now()

  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'PARSING' },
  })

  let staged: StagedRow[]
  try {
    staged = await buildStagedRows({
      buffer,
      format,
      mapping: resolveMapping(format, mapping),
      fileName,
      businessId: auth.businessId,
      prisma,
    })
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

  const errorCount = staged.filter((r) => r.status === 'ERROR').length
  const stagedCount = staged.length - errorCount

  // Bulk insert in chunks of 500 — Prisma createMany takes Json natively.
  for (let i = 0; i < staged.length; i += ROW_INSERT_CHUNK) {
    const chunk = staged.slice(i, i + ROW_INSERT_CHUNK)
    await prisma.importJobRow.createMany({
      data: chunk.map((r) => ({
        jobId,
        sourceIndex: r.sourceIndex,
        status: r.status,
        raw: r.raw as object,
        normalized: r.normalized as unknown as object,
        issues: r.normalized.issues as unknown as object,
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
        rowCount: staged.length,
        errorCount,
        commitToken,
        counts: {
          total: staged.length,
          staged: stagedCount,
          errors: errorCount,
        },
      },
    })
    await emitParsed(tx, auth, {
      jobId,
      rowCount: staged.length,
      errorCount,
      durationMs,
    })
    // Per-row drop audits — code/field only, no raw cell content (S9).
    for (const r of staged) {
      if (r.status !== 'ERROR') continue
      const first = r.normalized.issues[0]
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
    rowCount: staged.length,
    errorCount,
    durationMs,
  })
  return { rowCount: staged.length, errorCount, commitToken }
}
