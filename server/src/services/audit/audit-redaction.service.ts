/**
 * Audit-log redaction service — Phase 6 PR4 (architecture §7.6).
 *
 * Per-business config of field paths to mask before serving AuditLog.changes
 * to the FE. Write-time stores the raw diff (audit integrity); read-time
 * mutates the JSON to replace flagged paths with the literal '<redacted>'.
 *
 * Rationale for read-time-only masking:
 *   - Auditors who pull the table directly need ground truth.
 *   - A redaction rule added today must hide PII in rows written yesterday.
 *   - Adding/removing a rule is non-destructive (no backfill needed).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §7.6 + §18.5 row 107.
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'

export interface AuditRedaction {
  id: string
  businessId: string
  entityType: string
  fieldPath: string
  enabled: boolean
  createdAt: Date
  createdById: string
}

/**
 * Minimal shape needed for read-time masking. We do NOT add an index
 * signature so strict typed callers (e.g. AuditSearchRow) remain assignable
 * — TypeScript treats `{ [k: string]: unknown }` as a stricter contract than
 * a plain interface and refuses the assignment otherwise.
 */
export interface AuditRowForRedaction {
  entityType: string
  // Wire shape — JSON may be null, object, array, or scalar; we only touch objects.
  changes: unknown
}

/** ─── Queries ──────────────────────────────────────────────────────────── */

/** List every redaction rule for a business (both enabled and disabled). */
export async function listRedactions(businessId: string): Promise<AuditRedaction[]> {
  return prisma.auditLogRedaction.findMany({
    where: { businessId },
    orderBy: [{ entityType: 'asc' }, { fieldPath: 'asc' }],
  })
}

/**
 * Upsert a single redaction rule. (businessId, entityType, fieldPath) is the
 * declared unique key in schema.prisma:4122 — Prisma routes the write through
 * the @@unique constraint so concurrent callers can't double-insert.
 */
export async function setRedaction(params: {
  businessId: string
  entityType: string
  fieldPath: string
  enabled?: boolean
  createdById: string
}): Promise<AuditRedaction> {
  const { businessId, entityType, fieldPath, enabled = true, createdById } = params

  return prisma.auditLogRedaction.upsert({
    where: {
      businessId_entityType_fieldPath: { businessId, entityType, fieldPath },
    },
    create: { businessId, entityType, fieldPath, enabled, createdById },
    update: { enabled },
  })
}

/**
 * Soft-disable a redaction by id. We do NOT hard-delete because audit trail
 * hygiene wants the "rule existed at time T" history preserved. The unique
 * key blocks re-enabling via a duplicate insert; setRedaction() flips the
 * `enabled` flag instead.
 *
 * @throws AppError(NOT_FOUND, 404) if the id doesn't belong to this business.
 */
export async function disableRedaction(params: {
  businessId: string
  id: string
}): Promise<AuditRedaction> {
  const { businessId, id } = params
  const existing = await prisma.auditLogRedaction.findUnique({ where: { id } })
  if (!existing || existing.businessId !== businessId) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'Redaction rule not found')
  }
  return prisma.auditLogRedaction.update({
    where: { id },
    data: { enabled: false },
  })
}

/** ─── Read-time masking ─────────────────────────────────────────────────── */

/**
 * Walk a dot-path inside `obj` and overwrite the leaf with REDACTED_TOKEN.
 *
 * - Stops silently if any intermediate segment is missing or non-object.
 * - Stops if any segment hits a forbidden key (__proto__, prototype,
 *   constructor) — defense-in-depth against prototype pollution even though
 *   the schema regex already restricts fieldPath to [A-Za-z0-9_.].
 */
const REDACTED_TOKEN = '<redacted>'
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function setByPath(obj: unknown, path: string, value: string): void {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return
  const segments = path.split('.')
  if (segments.length === 0) return

  let cursor = obj as Record<string, unknown>
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    if (FORBIDDEN_KEYS.has(seg)) return
    const next = cursor[seg]
    if (!next || typeof next !== 'object' || Array.isArray(next)) return
    cursor = next as Record<string, unknown>
  }
  const leaf = segments[segments.length - 1]!
  if (FORBIDDEN_KEYS.has(leaf)) return
  if (Object.prototype.hasOwnProperty.call(cursor, leaf)) {
    cursor[leaf] = value
  }
}

/**
 * Apply redactions to a single AuditLog row. Returns a NEW row object (does
 * not mutate input) with `changes` replaced.
 *
 * Filters to redactions whose entityType matches AND enabled=true so disabled
 * rules are non-destructive for past data.
 */
export function applyRedactionsToRow<T extends AuditRowForRedaction>(
  row: T,
  redactions: readonly AuditRedaction[],
): T {
  const relevant = redactions.filter(
    (r) => r.enabled && r.entityType === row.entityType,
  )
  if (relevant.length === 0) return row

  const changes = row.changes
  // Only walk if changes is a plain object (the schema commitment for diffs).
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return row

  // structuredClone() preserves nested objects, arrays, and dates without the
  // JSON.parse(JSON.stringify(...)) round-trip cost or quirks (e.g. Date→string).
  const cloned = structuredClone(changes) as Record<string, unknown>
  for (const r of relevant) {
    setByPath(cloned, r.fieldPath, REDACTED_TOKEN)
  }
  return { ...row, changes: cloned }
}

/**
 * Convenience wrapper for the route handler — map a list of rows through
 * applyRedactionsToRow with the same redactions fetched once per request.
 */
export function applyRedactionsToRows<T extends AuditRowForRedaction>(
  rows: readonly T[],
  redactions: readonly AuditRedaction[],
): T[] {
  if (rows.length === 0 || redactions.length === 0) return [...rows]
  return rows.map((row) => applyRedactionsToRow(row, redactions))
}
