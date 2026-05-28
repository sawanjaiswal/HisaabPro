/**
 * #147 Bank reconciliation — DB access + scoping helpers.
 * Every query re-scopes by businessId (caller's token value, never from body).
 * writeMatch carries the TOCTOU (updateMany count===1) + P2002 idempotency guards.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type { CandidatePayment } from './bank-reconciliation.types.js'

export const POOL_CEILING = 5000

export function assertBusiness(businessId: string): void {
  if (!businessId) throw new AppError(ErrorCode.NO_BUSINESS, 403, 'No active business on session')
}

export async function assertBankAccount(businessId: string, bankAccountId: string): Promise<void> {
  const acct = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!acct) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Bank account not found')
}

export async function loadScopedLine(businessId: string, lineId: string) {
  const line = await prisma.bankStatementLine.findFirst({ where: { id: lineId, businessId } })
  if (!line) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Statement line not found')
  return line
}

/** ONE bounded query for the candidate pool (no N+1, hard 5000 ceiling). */
export async function loadCandidatePool(
  businessId: string,
  window: { min: Date; max: Date },
): Promise<{ pool: CandidatePayment[]; truncated: boolean }> {
  const reconciled = await prisma.reconciliationMatch.findMany({
    where: { businessId },
    select: { paymentId: true },
  })
  const excluded = reconciled.map((r) => r.paymentId)

  const rows = await prisma.payment.findMany({
    where: {
      businessId,
      isDeleted: false,
      date: { gte: window.min, lte: window.max },
      ...(excluded.length > 0 ? { id: { notIn: excluded } } : {}),
    },
    select: {
      id: true,
      date: true,
      amount: true,
      type: true,
      referenceNumber: true,
      party: { select: { name: true } },
    },
    orderBy: { id: 'asc' },
    take: POOL_CEILING + 1,
  })

  const truncated = rows.length > POOL_CEILING
  const pool = rows.slice(0, POOL_CEILING).map((p) => ({
    id: p.id,
    date: p.date.toISOString(),
    amount: p.amount,
    type: p.type,
    referenceNumber: p.referenceNumber,
    partyName: p.party?.name ?? null,
  }))
  return { pool, truncated }
}

/** Shared writer for AUTO/MANUAL matches with TOCTOU + P2002 guards. */
export async function writeMatch(
  businessId: string,
  userId: string,
  lineId: string,
  paymentId: string,
  confidence: number,
  method: 'AUTO' | 'MANUAL',
): Promise<{ lineId: string; paymentId: string; confidence: number; method: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const moved = await tx.bankStatementLine.updateMany({
        where: { id: lineId, businessId, status: { in: ['UNMATCHED', 'SUGGESTED'] } },
        data: { status: 'MATCHED' },
      })
      if (moved.count !== 1) {
        throw new AppError(ErrorCode.DUPLICATE_ENTRY, 409, 'Line is not open for matching')
      }
      await tx.reconciliationMatch.create({
        data: { businessId, lineId, paymentId, method, confidence, matchedBy: userId },
      })
      return { lineId, paymentId, confidence, method }
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(ErrorCode.DUPLICATE_ENTRY, 409, 'Line already reconciled')
    }
    throw err
  }
}
