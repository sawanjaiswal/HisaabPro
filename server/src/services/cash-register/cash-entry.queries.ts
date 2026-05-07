/**
 * Cash Register read queries — list, get, summary.
 * Cursor-based pagination; summary uses prisma aggregates (no findMany+reduce).
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { toCashEntryDTO } from './cash-entry.create.js'
import type { CashEntryDTO } from './cash-entry.create.js'

export type CashSummaryBucket = {
  inPaise: number
  outPaise: number
  netPaise: number
  count: number
}

export type CashDayBucket = CashSummaryBucket & { date: string }

export type CashSummaryDTO = {
  today: CashSummaryBucket
  last7Days: CashDayBucket[]
  last30: CashSummaryBucket
  range: { from: string; to: string }
}

function getPeriodStart(period: 'today' | '7d' | '30d', tzOffsetMinutes: number, now: Date): Date {
  // Shift to business-local midnight by adjusting UTC
  const localMs = now.getTime() + tzOffsetMinutes * 60 * 1000
  const localDate = new Date(localMs)
  const localMidnight = new Date(
    Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate()),
  )
  // Convert midnight back to UTC
  const utcMidnight = new Date(localMidnight.getTime() - tzOffsetMinutes * 60 * 1000)

  if (period === 'today') return utcMidnight
  if (period === '7d') return new Date(utcMidnight.getTime() - 6 * 24 * 60 * 60 * 1000)
  return new Date(utcMidnight.getTime() - 29 * 24 * 60 * 60 * 1000)
}

export async function listCashEntries(args: {
  businessId: string
  direction?: 'IN' | 'OUT'
  includeVoided?: boolean
  cursor?: string
  limit: number
}): Promise<{ entries: CashEntryDTO[]; nextCursor: string | null }> {
  const { businessId, direction, includeVoided, cursor, limit } = args

  const where: Record<string, unknown> = { businessId }
  if (direction) where.direction = direction
  if (!includeVoided) where.voidedAt = null

  const rows = await prisma.cashEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  let nextCursor: string | null = null
  if (rows.length > limit) {
    rows.pop()
    nextCursor = rows[rows.length - 1].id
  }

  return { entries: rows.map(toCashEntryDTO), nextCursor }
}

export async function getCashEntry(args: {
  businessId: string
  id: string
}): Promise<CashEntryDTO> {
  const row = await prisma.cashEntry.findFirst({
    where: { id: args.id, businessId: args.businessId },
  })
  if (!row) throw notFoundError('CashEntry')
  return toCashEntryDTO(row)
}

export async function getCashSummary(args: {
  businessId: string
  tzOffsetMinutes: number
  now?: Date
}): Promise<CashSummaryDTO> {
  const { businessId, tzOffsetMinutes } = args
  const now = args.now ?? new Date()

  const todayStart = getPeriodStart('today', tzOffsetMinutes, now)
  const sevenStart = getPeriodStart('7d', tzOffsetMinutes, now)
  const thirtyStart = getPeriodStart('30d', tzOffsetMinutes, now)

  // Pull all entries in last 30 days (one query) then aggregate in memory
  const rows = await prisma.cashEntry.findMany({
    where: { businessId, voidedAt: null, createdAt: { gte: thirtyStart } },
    select: { direction: true, amountPaise: true, createdAt: true },
  })

  const empty = (): CashSummaryBucket => ({ inPaise: 0, outPaise: 0, netPaise: 0, count: 0 })
  const add = (b: CashSummaryBucket, dir: 'IN' | 'OUT', amt: number) => {
    if (dir === 'IN') b.inPaise += amt
    else b.outPaise += amt
    b.netPaise = b.inPaise - b.outPaise
    b.count += 1
  }

  const today = empty()
  const last30 = empty()
  const dayMap = new Map<string, CashSummaryBucket>()

  // Pre-seed 7 day buckets (oldest → newest)
  for (let i = 6; i >= 0; i--) {
    const dayMs = todayStart.getTime() - i * 24 * 60 * 60 * 1000
    const local = new Date(dayMs + tzOffsetMinutes * 60 * 1000)
    const ymd = local.toISOString().slice(0, 10)
    dayMap.set(ymd, empty())
  }

  for (const r of rows) {
    const dir = r.direction as 'IN' | 'OUT'
    const amt = Number(r.amountPaise)
    add(last30, dir, amt)
    if (r.createdAt >= todayStart) add(today, dir, amt)
    if (r.createdAt >= sevenStart) {
      const local = new Date(r.createdAt.getTime() + tzOffsetMinutes * 60 * 1000)
      const ymd = local.toISOString().slice(0, 10)
      const b = dayMap.get(ymd)
      if (b) add(b, dir, amt)
    }
  }

  const last7Days: CashDayBucket[] = []
  for (const [date, b] of dayMap.entries()) {
    last7Days.push({ date, ...b })
  }

  return {
    today,
    last7Days,
    last30,
    range: { from: thirtyStart.toISOString(), to: now.toISOString() },
  }
}
