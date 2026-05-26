/**
 * Phase 7 — Import Engine · Dedup resolutions (API.8)
 *
 * Applies per-row decisions (SKIP / OVERWRITE / CREATE_NEW) captured by
 * the preview UI BEFORE the STAGED-row commit pass. Lives in its own file
 * so commit.helpers.ts stays ≤250 LOC and the resolutions story is easy
 * to read in isolation.
 *
 * Cross-references:
 *   - SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md (FE.4 + API.8)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §6.1
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M3, S6, S7, S9
 */

// PII: logger / audit calls MUST NOT include raw cell content —
// only jobId, rowId, status, counts (S9).
import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import type {
  AuthContext,
  DedupResolution,
} from '../../types/import.types.js'
import { emitPartiesUpdatedFromImport } from './audit-emit.js'
import type { Tx } from './commit.helpers.js'

interface ResolutionRowMin {
  id: string
  status: string
  normalized: unknown
  matchedPartyId: string | null
}

const DUP_STATUSES: ReadonlySet<string> = new Set([
  'DUPLICATE_EXACT',
  'DUPLICATE_NEAR',
])

export interface ApplyResolutionsResult {
  overwrittenPartyIds: string[]
  createNewRowIds: string[]
}

/**
 * Apply per-row dedup resolutions BEFORE the STAGED-row commit pass.
 *
 * - SKIP        no-op (DUPLICATE_* stays excluded by the chunk WHERE clause).
 * - CREATE_NEW  atomic updateMany scoped by (id, jobId, status IN DUP_*) →
 *               flip to STAGED + null matchedPartyId. Race-safe.
 * - OVERWRITE   load the matched party, update fields, mark row COMMITTED,
 *               emit one batched `parties.updated_from_import` audit row.
 *
 * Validation:
 *   - Each rowId MUST belong to `jobId` (cross-tenant 404).
 *   - Decision MUST match row status (must be DUPLICATE_*); mismatch → 400
 *     INVALID_RESOLUTION.
 *
 * Runs inside the outer $transaction so advisory lock + FOR UPDATE + audit
 * are unified with the rest of the commit pipeline.
 */
export async function applyDedupResolutions(
  tx: Tx,
  args: {
    jobId: string
    auth: AuthContext
    resolutions: DedupResolution[]
  },
): Promise<ApplyResolutionsResult> {
  const { jobId, auth, resolutions } = args
  if (resolutions.length === 0) {
    return { overwrittenPartyIds: [], createNewRowIds: [] }
  }

  // Load + tenancy-validate every referenced row in one query.
  const rowIds = resolutions.map((r) => r.rowId)
  const rows = (await tx.$queryRaw<ResolutionRowMin[]>`
    SELECT id, status, normalized, "matchedPartyId"
    FROM "ImportJobRow"
    WHERE "jobId" = ${jobId}
      AND id = ANY(${rowIds}::text[])
    FOR UPDATE
  `) as ResolutionRowMin[]
  if (rows.length !== resolutions.length) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      404,
      'One or more resolution rowIds do not belong to this import job',
    )
  }
  const byId = new Map(rows.map((r) => [r.id, r]))

  const overwrittenPartyIds: string[] = []
  const createNewRowIds: string[] = []

  for (const res of resolutions) {
    const row = byId.get(res.rowId)
    if (!row) {
      // Defence in depth — length check + tenancy filter already cover this.
      throw new AppError(ErrorCode.NOT_FOUND, 404, 'Resolution row not found')
    }
    if (!DUP_STATUSES.has(row.status)) {
      throw new AppError(
        ErrorCode.INVALID_RESOLUTION,
        400,
        `Row ${res.rowId} is ${row.status}; resolutions only apply to DUPLICATE_* rows`,
      )
    }
    if (res.decision === 'SKIP') continue
    if (res.decision === 'CREATE_NEW') {
      const flipped = await tx.importJobRow.updateMany({
        where: {
          id: res.rowId,
          jobId,
          status: { in: ['DUPLICATE_EXACT', 'DUPLICATE_NEAR'] },
        },
        data: {
          status: 'STAGED',
          matchedPartyId: null,
          dedupAction: 'CREATE_NEW',
        },
      })
      if (flipped.count !== 1) {
        logger.warn('import.commit.resolution_race', { rowId: res.rowId, jobId })
        continue
      }
      createNewRowIds.push(res.rowId)
      continue
    }
    // OVERWRITE
    if (!row.matchedPartyId) {
      throw new AppError(
        ErrorCode.INVALID_RESOLUTION,
        400,
        `Row ${res.rowId} has no matched party; cannot OVERWRITE`,
      )
    }
    const partyId = await overwriteMatchedParty(tx, {
      rowId: res.rowId,
      jobId,
      matchedPartyId: row.matchedPartyId,
      normalized: row.normalized,
      businessId: auth.businessId,
    })
    if (partyId) overwrittenPartyIds.push(partyId)
  }

  if (overwrittenPartyIds.length > 0) {
    await emitPartiesUpdatedFromImport(tx, {
      jobId,
      businessId: auth.businessId,
      userId: auth.userId,
      partyIds: overwrittenPartyIds,
      source: 'import-overwrite',
    })
  }

  return { overwrittenPartyIds, createNewRowIds }
}

async function overwriteMatchedParty(
  tx: Tx,
  args: {
    rowId: string
    jobId: string
    matchedPartyId: string
    normalized: unknown
    businessId: string
  },
): Promise<string | null> {
  const n = (args.normalized ?? {}) as {
    name?: string
    phoneE164?: string
    email?: string
    gstin?: string
    address?: string
  }
  // Tenant-scoped update — businessId in the WHERE prevents cross-tenant
  // writes even if matchedPartyId was tampered with at preview time.
  const updated = await tx.party.updateMany({
    where: { id: args.matchedPartyId, businessId: args.businessId },
    data: {
      ...(n.name !== undefined ? { name: n.name } : {}),
      ...(n.phoneE164 !== undefined ? { phone: n.phoneE164 } : {}),
      ...(n.email !== undefined ? { email: n.email } : {}),
      ...(n.gstin !== undefined ? { gstin: n.gstin } : {}),
      ...(n.address !== undefined ? { notes: n.address } : {}),
    },
  })
  if (updated.count !== 1) {
    logger.warn('import.commit.overwrite_miss', {
      rowId: args.rowId,
      jobId: args.jobId,
    })
    return null
  }
  // Row-level guard — only bind once. createPartyId is @unique at the DB,
  // so even a leak past this check cannot double-bind.
  const claimed = await tx.importJobRow.updateMany({
    where: {
      id: args.rowId,
      jobId: args.jobId,
      status: { in: ['DUPLICATE_EXACT', 'DUPLICATE_NEAR'] },
      createdPartyId: null,
    },
    data: {
      status: 'COMMITTED',
      createdPartyId: args.matchedPartyId,
      dedupAction: 'OVERWRITE',
    },
  })
  if (claimed.count !== 1) {
    logger.warn('import.commit.overwrite_row_race', {
      rowId: args.rowId,
      jobId: args.jobId,
    })
    return null
  }
  return args.matchedPartyId
}
