/**
 * #147 Bank reconciliation — manual/auto match, ignore, un-reconcile.
 * Each state change re-scopes by businessId in BOTH lookup and mutation `where`
 * and asserts the affected row count (TOCTOU). Un-reconcile is a row delete —
 * it never touches the Payment/ledger.
 */
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { suggestMatches, scoreCandidate, MATCH_THRESHOLDS } from './match-engine.js'
import {
  assertBusiness,
  loadScopedLine,
  loadCandidatePool,
  writeMatch,
} from './bank-reconciliation.repository.js'
import type { LineDirection } from './bank-reconciliation.types.js'

export async function matchLineManual(
  businessId: string,
  userId: string,
  lineId: string,
  paymentId: string,
) {
  assertBusiness(businessId)
  const line = await loadScopedLine(businessId, lineId)
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: { id: true, date: true, amount: true, type: true, referenceNumber: true, party: { select: { name: true } } },
  })
  if (!payment) throw new AppError(ErrorCode.PAYMENT_NOT_FOUND, 404, 'Payment not found')

  const confidence = scoreCandidate(
    {
      id: line.id,
      txnDate: line.txnDate.toISOString(),
      amount: line.amount,
      direction: line.direction as LineDirection,
      description: line.description,
      referenceNumber: line.referenceNumber,
    },
    {
      id: payment.id,
      date: payment.date.toISOString(),
      amount: payment.amount,
      type: payment.type,
      referenceNumber: payment.referenceNumber,
      partyName: payment.party?.name ?? null,
    },
  )
  return writeMatch(businessId, userId, lineId, paymentId, confidence, 'MANUAL')
}

export async function confirmLineAuto(businessId: string, userId: string, lineId: string) {
  assertBusiness(businessId)
  const line = await loadScopedLine(businessId, lineId)
  const DAY = 86_400_000
  const window = {
    min: new Date(line.txnDate.getTime() - 14 * DAY),
    max: new Date(line.txnDate.getTime() + 14 * DAY),
  }
  const { pool } = await loadCandidatePool(businessId, window)
  const [suggestion] = suggestMatches(
    [
      {
        id: line.id,
        txnDate: line.txnDate.toISOString(),
        amount: line.amount,
        direction: line.direction as LineDirection,
        description: line.description,
        referenceNumber: line.referenceNumber,
      },
    ],
    pool,
  )
  if (!suggestion?.suggestedPaymentId || suggestion.confidence < MATCH_THRESHOLDS.SUGGEST) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'No confident match to confirm')
  }
  return writeMatch(businessId, userId, lineId, suggestion.suggestedPaymentId, suggestion.confidence, 'AUTO')
}

export async function ignoreLine(businessId: string, lineId: string) {
  assertBusiness(businessId)
  const moved = await prisma.bankStatementLine.updateMany({
    where: { id: lineId, businessId, status: { in: ['UNMATCHED', 'SUGGESTED'] } },
    data: { status: 'IGNORED' },
  })
  if (moved.count !== 1) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Line not found or not ignorable')
  return { lineId, status: 'IGNORED' as const }
}

export async function unreconcileLine(businessId: string, lineId: string) {
  assertBusiness(businessId)
  return prisma.$transaction(async (tx) => {
    const removed = await tx.reconciliationMatch.deleteMany({ where: { lineId, businessId } })
    if (removed.count !== 1) throw new AppError(ErrorCode.NOT_FOUND, 404, 'No match to remove')
    await tx.bankStatementLine.updateMany({
      where: { id: lineId, businessId, status: 'MATCHED' },
      data: { status: 'UNMATCHED' },
    })
    return { lineId, status: 'UNMATCHED' as const }
  })
}
