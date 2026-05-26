/**
 * Phase 7 · 7.1C PR-C3 — single-invoice commit step.
 *
 * Per-row sequence: party fly-create (advisory lock inside) → Document
 * INSERT → DocumentLineItem.createMany (S8 P2003 → PRODUCT_DELETED_DURING_COMMIT)
 * → guarded ImportJobRow flip (count=0 → CONCURRENT_COMMIT_RACE).
 *
 * Counter math is intentionally OUT of this file — the outer commit
 * service owns `committedRowCount` (7.1B precedent in commit-products).
 */

import { AppError, ErrorCode } from '../../../lib/errors.js'
import type { Tx } from '../commit.helpers.js'
import { LINES_PER_INVOICE_CAP } from './invoice.constants.js'
import {
  resolvePartyForInvoice,
  type PartySnapshot,
} from './party-resolver.js'
import {
  isPrismaP2003,
  type StagedInvoiceRowMin,
} from './commit-invoices.helpers.js'

export interface CommitOneResult {
  documentId: string
  documentNumber: string | null
  partyId: string
  grandTotal: number
}

export async function commitOneInvoice(
  tx: Tx,
  row: StagedInvoiceRowMin,
  args: { jobId: string; businessId: string; userId: string },
  partySnapshot: PartySnapshot,
): Promise<CommitOneResult> {
  const n = row.normalized
  if (!n) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Row ${row.sourceIndex} has no normalized payload`,
    )
  }
  if (n.lines.length > LINES_PER_INVOICE_CAP) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `LINES_PER_INVOICE_EXCEEDED at row ${row.sourceIndex}`,
      { sourceIndex: row.sourceIndex, lineCount: n.lines.length },
    )
  }

  const party = await resolvePartyForInvoice({
    tx,
    businessId: args.businessId,
    jobId: args.jobId,
    userId: args.userId,
    snapshot: partySnapshot,
    candidate: {
      name: n.party.source.name,
      phone: n.party.source.phone,
    },
    mode: n.partyResolutionMode ?? 'MATCH_OR_FLY_CREATE',
  })

  const doc = await tx.document.create({
    data: {
      businessId: args.businessId,
      type: 'SALE_INVOICE',
      partyId: party.partyId,
      documentNumber: n.documentNumber,
      documentDate: new Date(n.documentDate),
      subtotal: n.subtotalPaise,
      totalCgst: n.totalCgstPaise,
      totalSgst: n.totalSgstPaise,
      totalIgst: n.totalIgstPaise,
      grandTotal: n.grandTotalPaise,
      notes: n.notes,
      createdBy: args.userId,
      importJobId: args.jobId,
      importedBy: args.userId,
    },
    select: { id: true, documentNumber: true, grandTotal: true },
  })

  try {
    await tx.documentLineItem.createMany({
      data: n.lines.map((l, idx) => ({
        documentId: doc.id,
        productId: l.resolved.productId as string,
        sortOrder: idx,
        quantity: l.qty,
        rate: l.ratePaise ?? 0,
        lineTotal: l.lineTotalPaise ?? 0,
        taxableValue: l.taxableValuePaise ?? 0,
        cgstAmount: l.cgstPaise ?? 0,
        sgstAmount: l.sgstPaise ?? 0,
        igstAmount: l.igstPaise ?? 0,
      })),
    })
  } catch (err) {
    if (isPrismaP2003(err)) {
      throw new AppError(
        ErrorCode.PRODUCT_DELETED_DURING_COMMIT,
        409,
        'A product referenced by this invoice was deleted during commit',
        { sourceIndex: row.sourceIndex },
      )
    }
    throw err
  }

  const guarded = await tx.importJobRow.updateMany({
    where: { id: row.id, status: 'STAGED', createdEntityId: null },
    data: { status: 'COMMITTED', createdEntityId: doc.id },
  })
  if (guarded.count === 0) {
    throw new AppError(
      ErrorCode.CONCURRENT_COMMIT_RACE,
      409,
      `Row ${row.sourceIndex} was bound by a concurrent commit; chunk rolled back`,
    )
  }

  return {
    documentId: doc.id,
    documentNumber: doc.documentNumber,
    partyId: party.partyId,
    grandTotal: doc.grandTotal,
  }
}
