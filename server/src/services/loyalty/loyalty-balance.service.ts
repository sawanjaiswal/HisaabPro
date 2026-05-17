/**
 * Loyalty #125 — Balance + ledger read service.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.2 (balance shape),
 * §3.3 (ledger list), §6.3 / NEW_S1 (cross-tenant 404 PARTY_NOT_FOUND).
 *
 * Both readers PRECHECK the partyId against the caller's tenant; cross-tenant
 * probes get 404 not 200-empty. Pattern mirrors `STAFF_NOT_FOUND` from PR2.
 *
 * Balance shape (architecture §3.2):
 *   - currentPoints    : sum of unexpired delta
 *   - lifetimeEarned   : sum of positive AC entries
 *   - lifetimeRedeemed : sum of |delta| of RD entries
 *   - expiringSoon     : sum of unexpired AC entries with expiresAt within
 *                       EXPIRING_SOON_LOOKAHEAD_DAYS
 */

import { prisma } from '../../lib/prisma.js'
import { loyaltyPartyNotFoundError } from './loyalty.errors.js'
import {
  LEDGER_PAGE_SIZE_DEFAULT,
  LEDGER_PAGE_SIZE_MAX,
  EXPIRING_SOON_LOOKAHEAD_DAYS,
} from './loyalty.constants.js'
import type { LoyaltyLedgerType } from './loyalty.constants.js'

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface LoyaltyBalanceDTO {
  partyId: string
  currentPoints: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  expiringSoonPoints: number
  expiringSoonDays: number
}

export interface LoyaltyLedgerRowDTO {
  id: string
  type: LoyaltyLedgerType
  delta: number
  note: string | null
  posSaleId: string | null
  documentId: string | null
  earnedAt: Date
  expiresAt: Date | null
  createdAt: Date
}

export interface LoyaltyLedgerPageDTO {
  rows: LoyaltyLedgerRowDTO[]
  nextCursor: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function assertPartyInTenant(businessId: string, partyId: string): Promise<void> {
  const found = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: { id: true },
  })
  if (!found) throw loyaltyPartyNotFoundError(partyId)
}

// ─── Balance ────────────────────────────────────────────────────────────────

export async function getBalance(
  businessId: string,
  partyId: string
): Promise<LoyaltyBalanceDTO> {
  await assertPartyInTenant(businessId, partyId)

  const now = new Date()
  const soonCutoff = new Date(now.getTime() + EXPIRING_SOON_LOOKAHEAD_DAYS * 24 * 3600 * 1000)

  // Aggregate ledger rows in one round-trip via groupBy.
  const grouped = await prisma.loyaltyLedger.groupBy({
    by: ['type'],
    where: { businessId, partyId },
    _sum: { delta: true },
  })

  let lifetimeEarned = 0
  let lifetimeRedeemed = 0
  for (const row of grouped) {
    const sum = row._sum.delta ?? 0
    if (row.type === 'AC') lifetimeEarned += sum
    if (row.type === 'RD') lifetimeRedeemed += Math.abs(sum)
  }

  // Current points = SUM(delta) where (expiresAt IS NULL OR expiresAt > now).
  const currentAgg = await prisma.loyaltyLedger.aggregate({
    where: {
      businessId,
      partyId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { delta: true },
  })
  const currentPoints = currentAgg._sum.delta ?? 0

  // Expiring soon = SUM(delta) of unexpired AC rows with expiresAt in
  // [now, now + EXPIRING_SOON_LOOKAHEAD_DAYS]. RD/EX rows do not have
  // expiresAt; only AC rows count toward "soon".
  const soonAgg = await prisma.loyaltyLedger.aggregate({
    where: {
      businessId,
      partyId,
      type: 'AC',
      expiresAt: { gt: now, lte: soonCutoff },
    },
    _sum: { delta: true },
  })
  const expiringSoonPoints = soonAgg._sum.delta ?? 0

  return {
    partyId,
    currentPoints: Math.max(0, currentPoints),
    lifetimeEarned,
    lifetimeRedeemed,
    expiringSoonPoints: Math.max(0, expiringSoonPoints),
    expiringSoonDays: EXPIRING_SOON_LOOKAHEAD_DAYS,
  }
}

// ─── Ledger list ────────────────────────────────────────────────────────────

export interface ListLedgerOptions {
  cursor?: string
  limit?: number
}

export async function listLedger(
  businessId: string,
  partyId: string,
  options: ListLedgerOptions = {}
): Promise<LoyaltyLedgerPageDTO> {
  await assertPartyInTenant(businessId, partyId)

  const take = Math.min(options.limit ?? LEDGER_PAGE_SIZE_DEFAULT, LEDGER_PAGE_SIZE_MAX)

  const rows = await prisma.loyaltyLedger.findMany({
    where: { businessId, partyId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
    select: {
      id: true,
      type: true,
      delta: true,
      note: true,
      posSaleId: true,
      documentId: true,
      earnedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  const hasMore = rows.length > take
  const page = hasMore ? rows.slice(0, take) : rows

  return {
    rows: page.map(r => ({
      id: r.id,
      type: r.type as LoyaltyLedgerType,
      delta: r.delta,
      note: r.note,
      posSaleId: r.posSaleId,
      documentId: r.documentId,
      earnedAt: r.earnedAt,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  }
}
