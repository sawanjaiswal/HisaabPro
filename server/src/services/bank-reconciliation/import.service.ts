/**
 * #147 Bank reconciliation — statement import + line listing.
 * Reconciliation never mutates Payment/ledger rows: it stages statement lines
 * and auto-suggests matches. businessId is always the caller's token value.
 */
import { prisma } from '../../lib/prisma.js'
import { suggestMatches } from './match-engine.js'
import { normaliseRows, computePeriod, poolWindow, contentHash } from './statement-parser.js'
import { assertBusiness, assertBankAccount, loadCandidatePool } from './bank-reconciliation.repository.js'
import type {
  LineWithSuggestion,
  MatchableLine,
  LineDirection,
} from './bank-reconciliation.types.js'
import type { CreateImportInput, ListLinesInput } from '../../schemas/bank-reconciliation.schemas.js'

export interface CreateImportResult {
  importId: string
  lines: LineWithSuggestion[]
  poolTruncated: boolean
  duplicateCount: number
}

export async function createImport(
  businessId: string,
  userId: string,
  input: CreateImportInput,
): Promise<CreateImportResult> {
  assertBusiness(businessId)
  await assertBankAccount(businessId, input.bankAccountId)

  const normalised = normaliseRows(input.rows)
  const period = computePeriod(normalised)! // rows.min(1) guarantees non-empty

  // Q4 soft re-upload dedupe — count rows identical to ones already staged for
  // this account (warn, never block).
  const existing = await prisma.bankStatementLine.findMany({
    where: { businessId, bankAccountId: input.bankAccountId },
    select: { txnDate: true, amount: true, direction: true, referenceNumber: true },
  })
  const existingHashes = new Set(
    existing.map((e) =>
      contentHash({
        txnDate: e.txnDate,
        amount: e.amount,
        direction: e.direction as LineDirection,
        description: null,
        referenceNumber: e.referenceNumber,
      }),
    ),
  )
  const duplicateCount = normalised.filter((r) => existingHashes.has(contentHash(r))).length

  const created = await prisma.$transaction(async (tx) => {
    const imp = await tx.bankStatementImport.create({
      data: {
        businessId,
        bankAccountId: input.bankAccountId,
        fileName: input.fileName,
        rowCount: normalised.length,
        periodStart: period.start,
        periodEnd: period.end,
        importedBy: userId,
      },
      select: { id: true },
    })
    await tx.bankStatementLine.createMany({
      data: normalised.map((r) => ({
        importId: imp.id,
        businessId,
        bankAccountId: input.bankAccountId,
        txnDate: r.txnDate,
        amount: r.amount,
        direction: r.direction,
        description: r.description,
        referenceNumber: r.referenceNumber,
      })),
    })
    return imp
  })

  const lineRows = await prisma.bankStatementLine.findMany({
    where: { importId: created.id, businessId },
    orderBy: { txnDate: 'asc' },
  })

  const window = poolWindow(period)
  const { pool, truncated } = await loadCandidatePool(businessId, window)

  const matchable: MatchableLine[] = lineRows.map((l) => ({
    id: l.id,
    txnDate: l.txnDate.toISOString(),
    amount: l.amount,
    direction: l.direction as LineDirection,
    description: l.description,
    referenceNumber: l.referenceNumber,
  }))
  const suggestions = suggestMatches(matchable, pool)
  const byLine = new Map(suggestions.map((s) => [s.lineId, s]))

  const suggestedIds = suggestions
    .filter((s) => s.status === 'SUGGESTED')
    .map((s) => s.lineId)
  if (suggestedIds.length > 0) {
    await prisma.bankStatementLine.updateMany({
      where: { id: { in: suggestedIds }, businessId, status: 'UNMATCHED' },
      data: { status: 'SUGGESTED' },
    })
  }

  const lines: LineWithSuggestion[] = lineRows.map((l) => {
    const s = byLine.get(l.id)
    return {
      id: l.id,
      txnDate: l.txnDate.toISOString(),
      amount: l.amount,
      direction: l.direction as LineDirection,
      description: l.description,
      referenceNumber: l.referenceNumber,
      status: s?.status === 'SUGGESTED' ? 'SUGGESTED' : 'UNMATCHED',
      suggestedPaymentId: s?.suggestedPaymentId ?? null,
      confidence: s?.confidence ?? 0,
      matchedPaymentId: null,
    }
  })

  return { importId: created.id, lines, poolTruncated: truncated, duplicateCount }
}

export async function listLines(businessId: string, filters: ListLinesInput) {
  assertBusiness(businessId)
  const limit = filters.limit ?? 50
  const rows = await prisma.bankStatementLine.findMany({
    where: {
      businessId,
      ...(filters.bankAccountId ? { bankAccountId: filters.bankAccountId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.importId ? { importId: filters.importId } : {}),
    },
    include: { match: { select: { paymentId: true, confidence: true, method: true } } },
    orderBy: [{ txnDate: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  })
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return {
    lines: page.map((l) => ({
      id: l.id,
      txnDate: l.txnDate.toISOString(),
      amount: l.amount,
      direction: l.direction as LineDirection,
      description: l.description,
      referenceNumber: l.referenceNumber,
      status: l.status,
      matchedPaymentId: l.match?.paymentId ?? null,
      confidence: l.match?.confidence ?? 0,
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  }
}
