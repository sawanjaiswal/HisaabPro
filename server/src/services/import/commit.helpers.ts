/**
 * Phase 7 — Import Engine · Commit service helpers
 *
 * Extracted from commit.service.ts to keep both files <250 LOC.
 * Contains the row-level guard primitives + the M3 four-field binding
 * assertion + the advisory-lock / row-lock SQL.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §6.1
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M3, S6, S7
 */

import { AppError, ErrorCode } from '../../lib/errors.js'
import { prisma as rootPrisma } from '../../lib/prisma.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { AuthContext } from '../../types/import.types.js'

/**
 * The interactive-transaction callback param of the extended client. Using
 * `Prisma.TransactionClient` directly trips on the soft-delete extension's
 * model-extension generics (TS 2345). Pulling the inferred type from
 * `$transaction` keeps us in sync with whatever extensions are layered on.
 */
export type Tx = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface StagedRowMin {
  id: string
  sourceIndex: number
  normalized: unknown
  matchedPartyId: string | null
}

export interface JobLockRow {
  id: string
  businessId: string
  userId: string
  status: string
  commitToken: string | null
  idempotencyKey: string | null
  createdPartyIds: unknown
  createdEntityIds?: unknown
  // 7.1B — discriminator consumed by commit-dispatcher.ts
  entity: string
}

export interface ChunkResult {
  createdPartyIds: string[]
  sourceIndices: number[]
  done: boolean
}

/**
 * S7 — `hashtextextended(text, seed)` returns bigint; the older
 * `hashtext` int4 variant collides at ~77k businesses.
 */
export async function acquireBusinessLock(
  tx: Tx,
  businessId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended('import-commit', 0),
      hashtextextended(${businessId}, 0)
    )
  `
}

/** SELECT FOR UPDATE the ImportJob row by id (tenancy checked separately). */
export async function lockJob(
  tx: Tx,
  jobId: string,
): Promise<JobLockRow | null> {
  const rows = await tx.$queryRaw<JobLockRow[]>`
    SELECT id, "businessId", "userId", status, "commitToken",
           "idempotencyKey", "createdPartyIds", entity
    FROM "ImportJob"
    WHERE id = ${jobId}
    FOR UPDATE
  `
  return rows[0] ?? null
}

/**
 * M3 — assert that the locked job row matches all four binding fields:
 *   status='PREVIEWED' AND commitToken AND idempotencyKey AND (biz,user)
 * Any miss = 409 BAD_COMMIT_TOKEN (uniform response to avoid oracle).
 */
export function assertCommitBind(
  row: JobLockRow | null,
  expected: { commitToken: string; idempotencyKey: string; auth: AuthContext },
): asserts row is JobLockRow {
  const ok =
    row !== null &&
    row.status === 'PREVIEWED' &&
    row.commitToken === expected.commitToken &&
    row.idempotencyKey === expected.idempotencyKey &&
    row.businessId === expected.auth.businessId &&
    row.userId === expected.auth.userId
  if (!ok) {
    throw new AppError(
      ErrorCode.BAD_COMMIT_TOKEN,
      409,
      'Commit token does not match an active preview',
    )
  }
}

// ── API.8 — dedup resolutions live in commit.resolutions.ts ─────────
// ── Parties commit chunk lives in commit-parties.service.ts ──────────
// ── Products commit chunk lives in commit-products.service.ts ────────
// (Split out to keep this file ≤250 LOC.)
//
// Back-compat re-export — pre-B1 callers (audit-coverage SSOT, existing
// commit.service.ts dispatcher) imported `commitChunk` from this file.
// The symbol now lives in commit-parties.service.ts; re-export here so
// the existing import surface remains stable through the split.
export { commitChunk } from './commit-parties.service.js'

// ─────────────────────────────────────────────────────────────────────
// Phase 7 · 7.1B — schema introspection probes
//
// Both probes are cached per-process: the migration state can only move
// forward (no rollback in prod), so the FIRST positive read is the LAST
// answer we need. Test code resets the cache via the exported helpers.
// ─────────────────────────────────────────────────────────────────────

let _hasCreatedEntityIdColumn: boolean | null = null

/**
 * M8 — introspect whether `"ImportJobRow"."createdEntityId"` exists.
 *
 * Used by `commit-parties.service.ts` to dual-write `createdEntityId`
 * alongside `createdPartyId` during the expand→backfill→contract overlap.
 * Slice 7.1B Migration B1 adds the column; until that migration ships to
 * a given environment the dual-write is silently a no-op.
 *
 * Cached per process — schema additions are forward-only.
 */
export async function hasCreatedEntityIdColumn(tx: Tx): Promise<boolean> {
  if (_hasCreatedEntityIdColumn !== null) return _hasCreatedEntityIdColumn
  const rows = await tx.$queryRaw<{ exists: number }[]>`
    SELECT 1 AS exists
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ImportJobRow'
      AND column_name  = 'createdEntityId'
    LIMIT 1
  `
  _hasCreatedEntityIdColumn = rows.length > 0
  return _hasCreatedEntityIdColumn
}

let _openingBalanceEnumChecked = false

/**
 * M9 — assert the `OPENING_BALANCE` precondition before opening the
 * products commit pipeline.
 *
 * Two valid states pass:
 *   (a) `StockMovementType` does NOT exist as a Postgres enum AND the
 *       `StockMovement.type` column is `text`. In that world the literal
 *       string 'OPENING_BALANCE' is always a valid value — nothing to
 *       enforce. (This is the current shadow / dev / prod shape.)
 *   (b) `StockMovementType` exists as a Postgres enum AND the
 *       'OPENING_BALANCE' label is present.
 *
 * Anything else → throw `IMPORT_PRECONDITION_MISSING` (503). The commit
 * pipeline refuses to run rather than write partial state.
 *
 * Cached per process — schema additions are forward-only.
 */
export async function assertOpeningBalanceEnum(): Promise<void> {
  if (_openingBalanceEnumChecked) return
  const enumRows = await rootPrisma.$queryRaw<{ has_label: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'StockMovementType'
        AND e.enumlabel = 'OPENING_BALANCE'
    ) AS has_label
  `
  const hasLabel = enumRows[0]?.has_label === true
  if (hasLabel) {
    _openingBalanceEnumChecked = true
    return
  }
  // Enum may not exist at all — confirm `type` column is plain text.
  const typeRows = await rootPrisma.$queryRaw<{ data_type: string }[]>`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'StockMovement'
      AND column_name  = 'type'
    LIMIT 1
  `
  if (typeRows[0]?.data_type === 'text') {
    _openingBalanceEnumChecked = true
    return
  }
  throw new AppError(
    ErrorCode.IMPORT_PRECONDITION_MISSING,
    503,
    'OPENING_BALANCE precondition not satisfied; run Phase 7 · 7.1B Migration B0',
  )
}

/** Test-only: reset both probe caches. NOT exported from a barrel. */
export function __resetIntrospectionCacheForTests(): void {
  _hasCreatedEntityIdColumn = null
  _openingBalanceEnumChecked = false
}
