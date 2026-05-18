/**
 * Audit-log search service — Phase 6 PR4 (architecture §7.5).
 *
 * Cursor-paginated search over `AuditLog` with optional full-text + filter
 * predicates. Uses raw SQL via `prisma.$queryRaw` because:
 *
 *   1. tsvector / GIN search is not expressible through the Prisma query
 *      builder — we need `searchVector @@ websearch_to_tsquery('english', $1)`.
 *   2. The actor join (`LEFT JOIN User`) is one-shot per page; Prisma's
 *      include() would issue a second SELECT, costing latency on 20-row
 *      pages with mixed null/non-null userIds (system rows).
 *
 * ────────────────────────────────────────────────────────────────────────
 *  v2.3 A03.1 — NEVER `to_tsquery`. ALWAYS `websearch_to_tsquery`.
 *
 *  to_tsquery() parses FTS operators (`&` `|` `!` `(` `)`) and throws a
 *  SQL syntax error on raw user input like `R&D`, `(test)`, or `a|b`.
 *  websearch_to_tsquery() accepts Google-style queries (`apple OR banana`,
 *  `"exact phrase"`, `-exclude`) and silently swallows operator-like
 *  punctuation that isn't its grammar. The fuzz battery in
 *  __tests__/audit-search.service.test.ts pins this choice.
 *
 *  If a future contributor "fixes" this back to to_tsquery, every user
 *  who searches for `R&D` or `(invoice)` gets a 500. Don't.
 * ────────────────────────────────────────────────────────────────────────
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §7.5 + §18.5 row 106.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type { AuditAction } from '../../schemas/audit.schemas.js'

/** ─── Types ─────────────────────────────────────────────────────────────── */

export interface AuditSearchRow {
  id: string
  businessId: string
  action: string
  entityType: string
  entityId: string
  entityLabel: string | null
  userId: string | null
  systemActor: string | null
  changes: unknown
  reason: string | null
  ipAddress: string | null
  deviceInfo: string | null
  createdAt: Date
  userName: string | null
  userEmail: string | null
}

export interface AuditSearchParams {
  businessId: string
  query?: string
  entityType?: string
  action?: AuditAction
  userId?: string
  dateFrom?: string | Date
  dateTo?: string | Date
  cursor?: string
  limit?: number
}

export interface AuditSearchResult {
  rows: AuditSearchRow[]
  nextCursor: string | null
}

interface CursorPayload {
  createdAt: string
  id: string
}

/** ─── Cursor encode/decode ──────────────────────────────────────────────── */

export function encodeCursor(row: { createdAt: Date; id: string }): string {
  const payload: CursorPayload = { createdAt: row.createdAt.toISOString(), id: row.id }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(raw: string): CursorPayload {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as CursorPayload
    if (
      typeof parsed !== 'object' || parsed === null
      || typeof parsed.createdAt !== 'string'
      || typeof parsed.id !== 'string'
      || Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      throw new Error('shape')
    }
    return parsed
  } catch {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid cursor')
  }
}

/** ─── Search ────────────────────────────────────────────────────────────── */

/**
 * Core search. Returns up to `limit` rows ordered by (createdAt DESC, id DESC)
 * and a nextCursor when there is at least one more page (we over-fetch
 * `limit + 1` and pop the extra to detect a next page in one round-trip).
 *
 * businessId is the only required filter — every other predicate is optional
 * AND-composed. Cross-tenant leak guard lives here: even if the caller is
 * the platform-admin role, this service refuses to widen past the supplied
 * businessId. The route MUST pass req.activeBusiness.id (not req.user.businessId
 * directly) so requireActiveBusiness has already verified membership.
 */
export async function searchAuditLogs(params: AuditSearchParams): Promise<AuditSearchResult> {
  const {
    businessId,
    query,
    entityType,
    action,
    userId,
    dateFrom,
    dateTo,
    cursor,
    limit = 20,
  } = params

  if (!businessId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'businessId is required')
  }
  if (limit < 1 || limit > 100) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'limit must be 1..100')
  }

  // Build filter fragments. Each branch is either Prisma.sql`AND ...` or empty.
  const queryFragment = query && query.length > 0
    ? Prisma.sql`AND al."searchVector" @@ websearch_to_tsquery('english', ${query})`
    : Prisma.empty
  const entityFragment = entityType
    ? Prisma.sql`AND al."entityType" = ${entityType}`
    : Prisma.empty
  const actionFragment = action
    ? Prisma.sql`AND al."action" = ${action}`
    : Prisma.empty
  const userFragment = userId
    ? Prisma.sql`AND al."userId" = ${userId}`
    : Prisma.empty
  const fromFragment = dateFrom
    ? Prisma.sql`AND al."createdAt" >= ${new Date(dateFrom)}`
    : Prisma.empty
  const toFragment = dateTo
    ? Prisma.sql`AND al."createdAt" <= ${new Date(dateTo)}`
    : Prisma.empty

  // Cursor predicate — strictly less-than the previous page tail.
  // (createdAt < X) OR (createdAt = X AND id < Y) is the standard tuple
  // comparison that keeps the GIN-friendly (businessId, createdAt) B-tree
  // index doing the heavy lift.
  let cursorFragment = Prisma.empty
  if (cursor) {
    const { createdAt: cAt, id: cId } = decodeCursor(cursor)
    const dateVal = new Date(cAt)
    cursorFragment = Prisma.sql`
      AND (al."createdAt" < ${dateVal}
           OR (al."createdAt" = ${dateVal} AND al."id" < ${cId}))
    `
  }

  // Over-fetch one to detect "has more"; trim before return.
  const overFetch = limit + 1

  const rows = await prisma.$queryRaw<AuditSearchRow[]>`
    SELECT
      al."id"            AS "id",
      al."businessId"    AS "businessId",
      al."action"        AS "action",
      al."entityType"    AS "entityType",
      al."entityId"      AS "entityId",
      al."entityLabel"   AS "entityLabel",
      al."userId"        AS "userId",
      al."systemActor"   AS "systemActor",
      al."changes"       AS "changes",
      al."reason"        AS "reason",
      al."ipAddress"     AS "ipAddress",
      al."deviceInfo"    AS "deviceInfo",
      al."createdAt"     AS "createdAt",
      u."name"           AS "userName",
      u."email"          AS "userEmail"
    FROM "AuditLog" al
    LEFT JOIN "User" u ON u."id" = al."userId"
    WHERE al."businessId" = ${businessId}
      ${queryFragment}
      ${entityFragment}
      ${actionFragment}
      ${userFragment}
      ${fromFragment}
      ${toFragment}
      ${cursorFragment}
    ORDER BY al."createdAt" DESC, al."id" DESC
    LIMIT ${overFetch}
  `

  let nextCursor: string | null = null
  if (rows.length === overFetch) {
    const tail = rows[limit - 1]
    if (tail) nextCursor = encodeCursor({ createdAt: tail.createdAt, id: tail.id })
    rows.pop()
  }

  return { rows, nextCursor }
}
