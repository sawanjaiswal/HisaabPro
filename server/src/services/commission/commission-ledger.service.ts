/**
 * Commission #128 — Ledger query service.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §4.4 (ledger query),
 * §6.3 (cross-tenant staff precheck — M4), §10 (leaderboard pagination).
 *
 * Read-only. Two public entries:
 *   listLedger     → tenant + staff-scoped, paginated (createdAt cursor) per
 *                    YYYY-MM period; returns rows + month-net summary.
 *   leaderboard    → tenant-scoped GROUP BY staffUserId, top-N by signed
 *                    `commissionPaise` SUM. Uses Prisma `groupBy` aggregate
 *                    (NOT findMany+reduce — required by file-discipline gate).
 *
 * Cross-tenant `staffUserId` precheck (M4) lives in the route handler — it
 * needs `req.user.businessId` and returns 404 STAFF_NOT_FOUND. Service
 * layer simply requires a valid (staffUserId, businessId) pair.
 */

import { prisma } from '../../lib/prisma.js'
import { staffNotFoundError } from './commission.errors.js'
import { COMMISSION_PAGE_SIZE_DEFAULT, COMMISSION_PAGE_SIZE_MAX } from './commission.constants.js'

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface CommissionLedgerRowDTO {
  id: string
  staffUserId: string
  ruleId: string | null
  posSaleId: string | null
  documentId: string | null
  basisPaise: number
  commissionPaise: number
  periodYearMonth: string
  createdAt: Date
  meta: unknown
}

export interface CommissionLedgerPageDTO {
  rows: CommissionLedgerRowDTO[]
  nextCursor: string | null
  summary: {
    periodYearMonth: string
    totalCommissionPaise: number
    rowCount: number
  }
}

export interface CommissionLeaderboardEntryDTO {
  staffUserId: string
  staffName: string | null
  totalCommissionPaise: number
  rowCount: number
}

// ─── Ledger query ──────────────────────────────────────────────────────────

export interface ListLedgerInput {
  staffUserId: string
  periodYearMonth: string
  cursor?: string
  limit?: number
}

/**
 * Tenant + staff + period scoped ledger query.
 * `cursor` = previous page's last row id (createdAt desc + id desc tiebreak).
 *
 * NOTE: cross-tenant staff precheck (M4) is the route's job — we trust the
 * caller's `(businessId, staffUserId)` pair here. To stay safe-by-default,
 * we still scope the row query by both columns so a bug in the route
 * would yield "0 rows" rather than leaking another tenant.
 */
export async function listLedger(
  businessId: string,
  input: ListLedgerInput
): Promise<CommissionLedgerPageDTO> {
  const limit = Math.min(input.limit ?? COMMISSION_PAGE_SIZE_DEFAULT, COMMISSION_PAGE_SIZE_MAX)

  // Cursor lookup — pull createdAt + id from the cursor row (still tenant-scoped).
  let cursorWhere: { createdAt: { lt: Date } } | undefined
  if (input.cursor) {
    const cursorRow = await prisma.commissionLedger.findFirst({
      where: { id: input.cursor, businessId, staffUserId: input.staffUserId },
      select: { createdAt: true },
    })
    if (cursorRow) cursorWhere = { createdAt: { lt: cursorRow.createdAt } }
  }

  const rows = await prisma.commissionLedger.findMany({
    where: {
      businessId,
      staffUserId: input.staffUserId,
      periodYearMonth: input.periodYearMonth,
      ...(cursorWhere ?? {}),
    },
    select: {
      id: true, staffUserId: true, ruleId: true,
      posSaleId: true, documentId: true,
      basisPaise: true, commissionPaise: true,
      periodYearMonth: true, createdAt: true, meta: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  })

  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]!.id : null

  // Month-net summary via aggregate (NOT findMany+reduce). One round-trip.
  const agg = await prisma.commissionLedger.aggregate({
    where: {
      businessId,
      staffUserId: input.staffUserId,
      periodYearMonth: input.periodYearMonth,
    },
    _sum: { commissionPaise: true },
    _count: { _all: true },
  })

  return {
    rows: pageRows,
    nextCursor,
    summary: {
      periodYearMonth: input.periodYearMonth,
      totalCommissionPaise: Number(agg._sum.commissionPaise ?? 0),
      rowCount: agg._count._all,
    },
  }
}

// ─── Leaderboard ───────────────────────────────────────────────────────────

export interface ListLeaderboardInput {
  periodYearMonth: string
  limit?: number
}

export async function listLeaderboard(
  businessId: string,
  input: ListLeaderboardInput
): Promise<CommissionLeaderboardEntryDTO[]> {
  const limit = Math.min(input.limit ?? COMMISSION_PAGE_SIZE_DEFAULT, COMMISSION_PAGE_SIZE_MAX)

  // Prisma groupBy aggregate — NOT findMany+reduce.
  const grouped = await prisma.commissionLedger.groupBy({
    by: ['staffUserId'],
    where: { businessId, periodYearMonth: input.periodYearMonth },
    _sum: { commissionPaise: true },
    _count: { _all: true },
    orderBy: { _sum: { commissionPaise: 'desc' } },
    take: limit,
  })

  if (grouped.length === 0) return []

  // Resolve staff names in ONE round-trip (no N+1).
  const userIds = grouped.map(g => g.staffUserId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  })
  const nameMap = new Map(users.map(u => [u.id, u.name]))

  return grouped.map(g => ({
    staffUserId: g.staffUserId,
    staffName: nameMap.get(g.staffUserId) ?? null,
    totalCommissionPaise: Number(g._sum.commissionPaise ?? 0),
    rowCount: g._count._all,
  }))
}

// ─── Cross-tenant staff precheck (helper for route — M4) ───────────────────

/**
 * Throws 404 STAFF_NOT_FOUND if `staffUserId` is not an ACTIVE BusinessUser
 * of `businessId`. Collapses {200-empty, 403} → 404 to kill the UUID
 * enumeration oracle. Caller invokes this BEFORE listLedger / listLeaderboard
 * when the staffUserId came from the request rather than `req.user.userId`.
 */
export async function assertStaffInBusiness(
  businessId: string,
  staffUserId: string
): Promise<void> {
  const target = await prisma.businessUser.findFirst({
    where: { userId: staffUserId, businessId, isActive: true },
    select: { userId: true },
  })
  if (!target) throw staffNotFoundError(staffUserId)
}
