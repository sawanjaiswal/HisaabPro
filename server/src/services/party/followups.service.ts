/**
 * Follow-up queue — GET /api/parties/follow-ups (architecture §3.5 / M3).
 *
 * Returns parties whose `followUpAt` falls within [now - 7d, now + withinDays]
 * AND IS NOT NULL, ordered by `followUpAt` ASC so the most urgent surfaces
 * first. The query uses the covering composite index
 *   idx_party_business_followup
 * planned in PR1 (and complements `idx_party_business_lastcontact_active`
 * added in §2.5 / M3 for dormant-party scans). businessId is the leading
 * column for tenant isolation; followUpAt drives the range filter;
 * isActive=true is the equality filter.
 *
 * M3 belt-and-braces clamp: even though Zod has already enforced `withinDays
 * <= 365`, the service clamps again to defeat any future caller (cron,
 * admin script) that bypasses the route layer. Same upper bound, same
 * 1-day lower bound. Negative or NaN inputs fall back to the default 30.
 */

import { prisma } from '../../lib/prisma.js'
import type {
  FollowUpPage,
  FollowUpRow,
  FollowUpsQueryParams,
} from '../../types/party-crm.types.js'

const DEFAULT_WITHIN_DAYS = 30
const MAX_WITHIN_DAYS = 365
const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
// Show parties whose follow-up date slipped up to 7 days ago alongside
// upcoming due dates — overdue rows are the most actionable.
const OVERDUE_WINDOW_DAYS = 7

function clampWithinDays(input: number): number {
  if (!Number.isFinite(input)) return DEFAULT_WITHIN_DAYS
  const intVal = Math.trunc(input)
  if (intVal < 1) return DEFAULT_WITHIN_DAYS
  if (intVal > MAX_WITHIN_DAYS) return MAX_WITHIN_DAYS
  return intVal
}

function clampLimit(input: number | undefined): number {
  if (!input || !Number.isFinite(input)) return DEFAULT_LIMIT
  const intVal = Math.trunc(input)
  if (intVal < 1) return DEFAULT_LIMIT
  if (intVal > MAX_LIMIT) return MAX_LIMIT
  return intVal
}

function daysOverdue(followUpAt: Date, now: Date): number {
  const deltaMs = now.getTime() - followUpAt.getTime()
  return Math.floor(deltaMs / MS_PER_DAY)
}

export async function getFollowUpsDue(
  businessId: string,
  params: FollowUpsQueryParams,
): Promise<FollowUpPage> {
  const withinDays = clampWithinDays(params.withinDays)
  const limit = clampLimit(params.limit)
  const now = new Date()
  const lowerBound = new Date(now.getTime() - OVERDUE_WINDOW_DAYS * MS_PER_DAY)
  const upperBound = new Date(now.getTime() + withinDays * MS_PER_DAY)

  // Cursor is an opaque ISO timestamp + id pair (`<iso>:<id>`) — keeps the
  // pagination stable across rows with the same followUpAt instant.
  const cursorRow = decodeCursor(params.cursor)

  const rows = await prisma.party.findMany({
    where: {
      businessId,
      isActive: true,
      followUpAt: { not: null, gte: lowerBound, lte: upperBound },
      ...(cursorRow ? cursorClause(cursorRow) : {}),
    },
    orderBy: [{ followUpAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    select: {
      id: true,
      name: true,
      phone: true,
      lastContactedAt: true,
      followUpAt: true,
    },
  })

  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore && sliced.length > 0
    ? encodeCursor(sliced[sliced.length - 1].followUpAt!, sliced[sliced.length - 1].id)
    : null

  const totalCount = await prisma.party.count({
    where: {
      businessId,
      isActive: true,
      followUpAt: { not: null, gte: lowerBound, lte: upperBound },
    },
  })

  const mapped: FollowUpRow[] = sliced.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    lastContactedAt: p.lastContactedAt ? p.lastContactedAt.toISOString() : null,
    followUpAt: p.followUpAt ? p.followUpAt.toISOString() : null,
    daysOverdue: p.followUpAt ? daysOverdue(p.followUpAt, now) : 0,
  }))

  return {
    rows: mapped,
    nextCursor,
    totalCount,
  }
}

// ─── Cursor helpers (opaque base64) ─────────────────────────────────────────

function encodeCursor(followUpAt: Date, id: string): string {
  const raw = `${followUpAt.toISOString()}|${id}`
  return Buffer.from(raw, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string | undefined): { followUpAt: Date; id: string } | null {
  if (!cursor) return null
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const [iso, id] = raw.split('|')
    if (!iso || !id) return null
    const followUpAt = new Date(iso)
    if (Number.isNaN(followUpAt.getTime())) return null
    return { followUpAt, id }
  } catch {
    return null
  }
}

function cursorClause(cursor: { followUpAt: Date; id: string }) {
  return {
    OR: [
      { followUpAt: { gt: cursor.followUpAt } },
      {
        AND: [
          { followUpAt: { equals: cursor.followUpAt } },
          { id: { gt: cursor.id } },
        ],
      },
    ],
  }
}
