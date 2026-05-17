/**
 * POS ↔ Loyalty void/restore symmetry helpers.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.4.1 (VD / VR rows).
 *
 * Contract (test 12.12):
 *  - voidForPosSale  → for every AC/RD row tied to this posSaleId, write one
 *    inverse-delta VD row. Idempotent: re-running on already-voided sale
 *    writes zero rows (looks up existing VD rows by note sentinel).
 *  - restoreForPosSale → for every VD row tied to this posSaleId, write one
 *    inverse-delta VR row. Net result: ledger sums return to original AC/RD
 *    values. Idempotent the same way.
 *
 * Loyalty does NOT need deep-clone of any rule snapshot here — that's
 * Commission #128 territory (PR5). LoyaltyProgram is flat; AC rows already
 * carry the points value, no rule re-evaluation needed at void/restore time.
 */

import type { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

const VOID_NOTE_PREFIX = '[void of '
const RESTORE_NOTE_PREFIX = '[restore of '

function voidNoteFor(srcRowId: string): string {
  return `${VOID_NOTE_PREFIX}${srcRowId}]`
}

function restoreNoteFor(srcVdRowId: string): string {
  return `${RESTORE_NOTE_PREFIX}${srcVdRowId}]`
}

export interface VoidSymmetryResult {
  acRdRowsFound: number
  vdRowsWritten: number
}

export interface RestoreSymmetryResult {
  vdRowsFound: number
  vrRowsWritten: number
}

// ─── Void ──────────────────────────────────────────────────────────────────

export async function voidForPosSale(
  tx: TxClient,
  businessId: string,
  posSaleId: string
): Promise<VoidSymmetryResult> {
  // Source rows = AC/RD ledger entries belonging to this sale.
  const sourceRows = await tx.loyaltyLedger.findMany({
    where: {
      businessId,
      posSaleId,
      type: { in: ['AC', 'RD'] },
    },
    select: { id: true, partyId: true, delta: true, type: true },
  })

  if (sourceRows.length === 0) {
    return { acRdRowsFound: 0, vdRowsWritten: 0 }
  }

  // Idempotency — skip ones we already voided.
  const expectedNotes = sourceRows.map(r => voidNoteFor(r.id))
  const existingVd = await tx.loyaltyLedger.findMany({
    where: { businessId, posSaleId, type: 'VD', note: { in: expectedNotes } },
    select: { note: true },
  })
  const handled = new Set(existingVd.map(r => r.note))

  const toInsert = sourceRows.filter(r => !handled.has(voidNoteFor(r.id)))
  if (toInsert.length === 0) {
    return { acRdRowsFound: sourceRows.length, vdRowsWritten: 0 }
  }

  const now = new Date()
  await tx.loyaltyLedger.createMany({
    data: toInsert.map(src => ({
      businessId,
      partyId: src.partyId,
      type: 'VD',
      delta: -src.delta, // inverse sign → AC(+) becomes VD(-); RD(-) becomes VD(+)
      posSaleId,
      earnedAt: now,
      note: voidNoteFor(src.id),
    } satisfies Prisma.LoyaltyLedgerUncheckedCreateInput)),
  })

  return { acRdRowsFound: sourceRows.length, vdRowsWritten: toInsert.length }
}

// ─── Restore ───────────────────────────────────────────────────────────────

export async function restoreForPosSale(
  tx: TxClient,
  businessId: string,
  posSaleId: string
): Promise<RestoreSymmetryResult> {
  // Source rows = VD entries belonging to this sale.
  const vdRows = await tx.loyaltyLedger.findMany({
    where: { businessId, posSaleId, type: 'VD' },
    select: { id: true, partyId: true, delta: true },
  })

  if (vdRows.length === 0) {
    return { vdRowsFound: 0, vrRowsWritten: 0 }
  }

  // Idempotency — skip ones we already restored.
  const expectedNotes = vdRows.map(r => restoreNoteFor(r.id))
  const existingVr = await tx.loyaltyLedger.findMany({
    where: { businessId, posSaleId, type: 'VR', note: { in: expectedNotes } },
    select: { note: true },
  })
  const handled = new Set(existingVr.map(r => r.note))

  const toInsert = vdRows.filter(r => !handled.has(restoreNoteFor(r.id)))
  if (toInsert.length === 0) {
    return { vdRowsFound: vdRows.length, vrRowsWritten: 0 }
  }

  const now = new Date()
  await tx.loyaltyLedger.createMany({
    data: toInsert.map(vd => ({
      businessId,
      partyId: vd.partyId,
      type: 'VR',
      delta: -vd.delta, // inverse of the VD → restores the original sign
      posSaleId,
      earnedAt: now,
      note: restoreNoteFor(vd.id),
    } satisfies Prisma.LoyaltyLedgerUncheckedCreateInput)),
  })

  return { vdRowsFound: vdRows.length, vrRowsWritten: toInsert.length }
}
