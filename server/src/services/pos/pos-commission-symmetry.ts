/**
 * POS ↔ Commission void/restore symmetry helpers.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.2 (void),
 * §3.4.1 (restore), §4.2 (M1 deep-clone callout box).
 *
 * Contract (test 12.12 — extended to commission):
 *  - voidCommissionForPosSale    → for every POS/INVOICE ledger row tied to
 *    this posSaleId, write ONE inverse-paise VOID row. The snapshot is
 *    DEEP-CLONED from the SOURCE row's `meta.ruleSnapshot` — NEVER from the
 *    live CommissionRule (the rule may have been edited or soft-deleted
 *    between accrual and reversal). Idempotent: re-running on an already-
 *    voided sale writes zero rows (lookup by `meta.source = 'VOID'` +
 *    `meta.voidOf = <source row id>` sentinel).
 *  - restoreCommissionForPosSale → for every VOID row tied to this
 *    posSaleId, write ONE counter-inverse RESTORE row. Snapshot deep-
 *    cloned from the VOID row's snapshot (chain unbroken). Idempotent
 *    via `meta.restoreOf = <void row id>` sentinel.
 *
 * Sentinel design — unlike loyalty (which uses a `note` column), the
 * commission ledger has no string `note`; we encode the "this row is the
 * cancel-of <id>" link inside `meta` (Json column) as a discriminated
 * sentinel and key the idempotency check on it via a server-side filter.
 */

import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { cloneFromPriorMeta } from '../commission/commission-snapshot.utils.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

// ─── Sentinel keys (live inside `meta`) ────────────────────────────────────

export const VOID_META_SOURCE = 'VOID' as const
export const RESTORE_META_SOURCE = 'RESTORE' as const

export interface CommissionSymmetryResult {
  sourceRowsFound: number
  reversalRowsWritten: number
}

// ─── Void ──────────────────────────────────────────────────────────────────

export async function voidCommissionForPosSale(
  tx: TxClient,
  businessId: string,
  posSaleId: string
): Promise<CommissionSymmetryResult> {
  // Source rows = original POS/INVOICE ledger entries (NOT prior VOID/RESTORE).
  const sourceRows = await tx.commissionLedger.findMany({
    where: {
      businessId,
      posSaleId,
      meta: { path: ['source'], not: { in: [VOID_META_SOURCE, RESTORE_META_SOURCE] } as unknown as Prisma.InputJsonValue },
    },
    select: {
      id: true, staffUserId: true, ruleId: true, basisPaise: true,
      commissionPaise: true, periodYearMonth: true, documentId: true, meta: true,
    },
  })

  if (sourceRows.length === 0) {
    return { sourceRowsFound: 0, reversalRowsWritten: 0 }
  }

  // Idempotency — skip ones we already voided. Server-side JSON filter on
  // `meta.voidOf ∈ <sourceIds>` returns the rows we've already written.
  const sourceIds = sourceRows.map(r => r.id)
  const existingVoids = await tx.commissionLedger.findMany({
    where: {
      businessId, posSaleId,
      meta: { path: ['voidOf'], not: Prisma.AnyNull },
    },
    select: { meta: true },
  })
  const handled = new Set<string>()
  for (const row of existingVoids) {
    const m = row.meta as { voidOf?: unknown } | null
    if (m && typeof m.voidOf === 'string' && sourceIds.includes(m.voidOf)) {
      handled.add(m.voidOf)
    }
  }

  const toWrite = sourceRows.filter(r => !handled.has(r.id))
  if (toWrite.length === 0) {
    return { sourceRowsFound: sourceRows.length, reversalRowsWritten: 0 }
  }

  const nowIso = new Date().toISOString()
  for (const src of toWrite) {
    // v3 / M1 — re-snapshot from the SOURCE ROW's meta, NEVER from live rule.
    const snapshot = cloneFromPriorMeta(src.meta)
    await tx.commissionLedger.create({
      data: {
        businessId,
        staffUserId: src.staffUserId,
        ruleId: src.ruleId,
        posSaleId,
        documentId: src.documentId,
        basisPaise: src.basisPaise,
        commissionPaise: -src.commissionPaise, // inverse — negates the original
        periodYearMonth: src.periodYearMonth,
        meta: {
          ruleSnapshot: snapshot,
          source: VOID_META_SOURCE,
          voidOf: src.id,
          appliedAt: nowIso,
        } as unknown as Prisma.InputJsonValue,
      },
    })
  }

  return { sourceRowsFound: sourceRows.length, reversalRowsWritten: toWrite.length }
}

// ─── Restore ───────────────────────────────────────────────────────────────

export async function restoreCommissionForPosSale(
  tx: TxClient,
  businessId: string,
  posSaleId: string
): Promise<CommissionSymmetryResult> {
  // Source rows = VOID entries belonging to this sale.
  const voidRows = await tx.commissionLedger.findMany({
    where: {
      businessId, posSaleId,
      meta: { path: ['source'], equals: VOID_META_SOURCE },
    },
    select: {
      id: true, staffUserId: true, ruleId: true, basisPaise: true,
      commissionPaise: true, periodYearMonth: true, documentId: true, meta: true,
    },
  })

  if (voidRows.length === 0) {
    return { sourceRowsFound: 0, reversalRowsWritten: 0 }
  }

  const voidIds = voidRows.map(r => r.id)
  const existingRestores = await tx.commissionLedger.findMany({
    where: {
      businessId, posSaleId,
      meta: { path: ['restoreOf'], not: Prisma.AnyNull },
    },
    select: { meta: true },
  })
  const handled = new Set<string>()
  for (const row of existingRestores) {
    const m = row.meta as { restoreOf?: unknown } | null
    if (m && typeof m.restoreOf === 'string' && voidIds.includes(m.restoreOf)) {
      handled.add(m.restoreOf)
    }
  }

  const toWrite = voidRows.filter(r => !handled.has(r.id))
  if (toWrite.length === 0) {
    return { sourceRowsFound: voidRows.length, reversalRowsWritten: 0 }
  }

  const nowIso = new Date().toISOString()
  for (const vd of toWrite) {
    // v3 / M1 — re-snapshot from the VOID row's meta (chain unbroken).
    const snapshot = cloneFromPriorMeta(vd.meta)
    await tx.commissionLedger.create({
      data: {
        businessId,
        staffUserId: vd.staffUserId,
        ruleId: vd.ruleId,
        posSaleId,
        documentId: vd.documentId,
        basisPaise: vd.basisPaise,
        commissionPaise: -vd.commissionPaise, // inverse of VOID's negative = back to positive
        periodYearMonth: vd.periodYearMonth,
        meta: {
          ruleSnapshot: snapshot,
          source: RESTORE_META_SOURCE,
          restoreOf: vd.id,
          appliedAt: nowIso,
        } as unknown as Prisma.InputJsonValue,
      },
    })
  }

  return { sourceRowsFound: voidRows.length, reversalRowsWritten: toWrite.length }
}
