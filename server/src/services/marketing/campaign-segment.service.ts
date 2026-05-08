/**
 * Campaign Segment Service — SegmentFilter → Prisma query (PR3)
 *
 * Security: explicit allowlist switch — NO dynamic key iteration.
 * Banned: $queryRawUnsafe, $executeRawUnsafe.
 * Result cap: take 10_001 (sentinel for too-large check).
 */

import { prisma } from '../../lib/prisma.js'
import type { SegmentFilter } from './campaign-segment.types.js'
import type { Prisma } from '@prisma/client'

const CAP = 10_001

// Build Prisma where from SegmentFilter — explicit allowlist only
function buildWhere(
  businessId: string,
  filter: SegmentFilter,
): Prisma.PartyWhereInput {
  const now = new Date()
  const where: Prisma.PartyWhereInput = {
    businessId,
    isDeleted: false,
    isActive: true,
    phone: { not: null },
    marketingOptOut: false,
  }

  // partyType
  switch (filter.partyType ?? 'CUSTOMER') {
    case 'CUSTOMER':
      where.type = 'CUSTOMER'
      break
    case 'SUPPLIER':
      where.type = 'SUPPLIER'
      break
    case 'BOTH':
      // no type filter
      break
  }

  // tags — all listed tags must be present (Prisma hasEvery)
  if (filter.tags && filter.tags.length > 0) {
    where.tags = { hasEvery: filter.tags }
  }

  // cityContains — Prisma parameterised ilike (safe)
  if (filter.cityContains) {
    where.addresses = {
      some: {
        city: { contains: filter.cityContains, mode: 'insensitive' },
        isDeleted: false,
      },
    }
  }

  // inactiveDays
  if (filter.inactiveDays != null) {
    const cutoff = new Date(now.getTime() - filter.inactiveDays * 86_400_000)
    where.lastTransactionAt = { lt: cutoff }
  }

  // outstandingGtePaise
  if (filter.outstandingGtePaise != null) {
    const amount = Math.trunc(filter.outstandingGtePaise)
    where.outstandingBalance = { gt: amount }
  }

  // birthdayThisWeek — birthday MM-DD falls within next 7 calendar days
  if (filter.birthdayThisWeek) {
    const candidates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() + i * 86_400_000)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      candidates.push(`${mm}-${dd}`)
    }
    // Use Prisma raw but NOT rawUnsafe — use $queryRaw with tagged template
    // Actually we filter in JS after fetching with birthday IS NOT NULL
    // This filter is applied post-fetch; mark in where for birthday IS NOT NULL
    where.birthday = { not: null }
    // Additional JS-level MM-DD filter applied in resolvePartyIds
    ;(where as Record<string, unknown>)['__birthdayMmDd'] = candidates
  }

  return where
}

// ---------------------------------------------------------------------------
// Resolve party IDs for a campaign launch (with cap)
// ---------------------------------------------------------------------------

export async function resolvePartyIds(
  businessId: string,
  filter: SegmentFilter,
): Promise<{ partyIds: string[]; tooLarge: boolean }> {
  const where = buildWhere(businessId, filter)
  const birthdayMmDd = (where as Record<string, unknown>)['__birthdayMmDd'] as string[] | undefined
  delete (where as Record<string, unknown>)['__birthdayMmDd']

  const parties = await prisma.party.findMany({
    where,
    select: { id: true, birthday: true },
    take: CAP,
    orderBy: { id: 'asc' },
  })

  let filtered = parties
  if (birthdayMmDd) {
    filtered = parties.filter((p) => {
      if (!p.birthday) return false
      const mm = String(p.birthday.getMonth() + 1).padStart(2, '0')
      const dd = String(p.birthday.getDate()).padStart(2, '0')
      return birthdayMmDd.includes(`${mm}-${dd}`)
    })
  }

  return {
    partyIds: filtered.map((p) => p.id),
    tooLarge: parties.length === CAP,
  }
}

// ---------------------------------------------------------------------------
// Preview (count + sample) — for POST /segments/preview
// ---------------------------------------------------------------------------

export async function previewSegment(
  businessId: string,
  filter: SegmentFilter,
): Promise<{
  count: number
  sample: Array<{ id: string; name: string; phone: string | null; hasBirthday: boolean }>
}> {
  const where = buildWhere(businessId, filter)
  const birthdayMmDd = (where as Record<string, unknown>)['__birthdayMmDd'] as string[] | undefined
  delete (where as Record<string, unknown>)['__birthdayMmDd']

  const parties = await prisma.party.findMany({
    where,
    select: { id: true, name: true, phone: true, birthday: true },
    take: CAP,
    orderBy: { id: 'asc' },
  })

  let filtered = parties
  if (birthdayMmDd) {
    filtered = parties.filter((p) => {
      if (!p.birthday) return false
      const mm = String(p.birthday.getMonth() + 1).padStart(2, '0')
      const dd = String(p.birthday.getDate()).padStart(2, '0')
      return birthdayMmDd.includes(`${mm}-${dd}`)
    })
  }

  const sample = filtered.slice(0, 5).map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    hasBirthday: p.birthday != null,
  }))

  return { count: filtered.length, sample }
}

// ---------------------------------------------------------------------------
// Filter a given set of partyIds by the segment filter (used by reminder cron)
// ---------------------------------------------------------------------------

export async function filterPartyIds(
  businessId: string,
  filter: SegmentFilter,
  partyIds: string[],
): Promise<Set<string>> {
  if (partyIds.length === 0) return new Set()

  const where = buildWhere(businessId, filter)
  delete (where as Record<string, unknown>)['__birthdayMmDd']

  const parties = await prisma.party.findMany({
    where: { ...where, id: { in: partyIds } },
    select: { id: true },
  })

  return new Set(parties.map((p) => p.id))
}
