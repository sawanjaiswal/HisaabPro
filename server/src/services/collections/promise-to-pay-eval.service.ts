/**
 * Promise-to-Pay — list, markKept, and evaluateOpenPtps.
 *
 * Split from promise-to-pay.service.ts to stay ≤250 LOC.
 * MB-7: evaluateOpenPtps writes AuditLog with userId=NULL, systemActor='cron:ptp-evaluator'.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

// ─── List ────────────────────────────────────────────────────────────────────

export interface ListPtpOptions {
  partyId?: string
  status?: string
  cursor?: string
  limit?: number
}

type ValidStatus = 'OPEN' | 'KEPT' | 'BROKEN' | 'CANCELLED'

export async function listPtps(businessId: string, opts: ListPtpOptions) {
  const { partyId, status, cursor, limit = 20 } = opts

  const where = {
    businessId,
    isDeleted: false,
    ...(partyId ? { partyId } : {}),
    ...(status ? { status: status as ValidStatus } : {}),
  }

  const take = Math.min(limit, 100)

  let cursorClause: { OR: Array<Record<string, unknown>> } | undefined
  if (cursor) {
    // cursor = base64(createdAt|id)
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    const [createdAtStr, id] = decoded.split('|')
    cursorClause = {
      OR: [
        { createdAt: { lt: new Date(createdAtStr) } },
        { createdAt: new Date(createdAtStr), id: { lt: id } },
      ],
    }
  }

  const rows = await prisma.promiseToPay.findMany({
    where: cursorClause ? { AND: [where, cursorClause] } : where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    include: {
      party: { select: { id: true, name: true, phone: true } },
      invoice: { select: { id: true, documentNumber: true } },
    },
  })

  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows

  const nextCursor = hasMore
    ? Buffer.from(`${items[items.length - 1].createdAt.toISOString()}|${items[items.length - 1].id}`).toString('base64')
    : null

  return { items, nextCursor }
}

// ─── Mark Kept ───────────────────────────────────────────────────────────────

export async function markPtpKept(
  businessId: string,
  ptpId: string,
  paymentId: string,
  userId: string | null,
  systemActor?: string,
) {
  const ptp = await prisma.promiseToPay.findFirst({
    where: { id: ptpId, businessId, isDeleted: false },
  })
  if (!ptp) {
    const err = new Error('PTP not found')
    ;(err as NodeJS.ErrnoException).code = 'PTP_NOT_FOUND'
    throw err
  }

  if (ptp.status !== 'OPEN') {
    // Already resolved — silently skip (idempotent for webhook calls)
    return ptp
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.promiseToPay.update({
      where: { id: ptpId },
      data: {
        status: 'KEPT',
        keptAt: new Date(),
        satisfyingPaymentIds: { set: [paymentId] },
        updatedBy: userId ?? systemActor ?? 'system',
      },
    })

    await tx.auditLog.create({
      data: {
        businessId,
        action: 'PTP_KEPT',
        entityType: 'PromiseToPay',
        entityId: ptpId,
        entityLabel: `PTP ${ptpId}`,
        userId: userId ?? null,
        systemActor: systemActor ?? null,
        changes: { paymentId },
      },
    })

    return result
  })

  logger.info('ptp.marked_kept', { ptpId, businessId, paymentId })
  return updated
}

// ─── Evaluate Open PTPs (cron) ────────────────────────────────────────────────

/**
 * For a given business, evaluate all OPEN PTPs where promiseDate < asOf.
 * Checks if qualifying payments sum >= ptp.amountPaise.
 * If yes → KEPT; else → BROKEN.
 *
 * MB-7: AuditLog uses userId=NULL, systemActor='cron:ptp-evaluator'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function evaluateOpenPtps(
  businessId: string,
  asOf: Date,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
  const db = tx ?? prisma

  const openPtps = await db.promiseToPay.findMany({
    where: {
      businessId,
      status: 'OPEN',
      isDeleted: false,
      promiseDate: { lt: asOf },
    },
    select: {
      id: true,
      partyId: true,
      invoiceId: true,
      amountPaise: true,
      promiseDate: true,
    },
  })

  if (openPtps.length === 0) return

  for (const ptp of openPtps) {
    try {
      // Find qualifying payments on/before promiseDate
      const allocations = ptp.invoiceId
        ? await db.paymentAllocation.findMany({
            where: {
              invoiceId: ptp.invoiceId,
              payment: {
                businessId,
                date: { lte: ptp.promiseDate },
                isDeleted: false,
              },
            },
            select: { amount: true, paymentId: true },
            orderBy: { createdAt: 'desc' },
          })
        : await db.paymentAllocation.findMany({
            where: {
              payment: {
                businessId,
                partyId: ptp.partyId,
                date: { lte: ptp.promiseDate },
                isDeleted: false,
              },
            },
            select: { amount: true, paymentId: true },
            orderBy: { createdAt: 'desc' },
          })

      const totalPaid = allocations.reduce((s, a) => s + a.amount, 0)
      const isKept = totalPaid >= ptp.amountPaise
      const newStatus = isKept ? 'KEPT' : 'BROKEN'
      const mostRecentPaymentId = allocations[0]?.paymentId ?? null

      await db.promiseToPay.update({
        where: { id: ptp.id },
        data: {
          status: newStatus,
          ...(isKept ? { keptAt: new Date() } : { brokenAt: new Date() }),
          ...(isKept && mostRecentPaymentId
            ? { satisfyingPaymentIds: { set: [mostRecentPaymentId] } }
            : {}),
          updatedBy: 'cron:ptp-evaluator',
        },
      })

      await db.auditLog.create({
        data: {
          businessId,
          action: `PTP_${newStatus}`,
          entityType: 'PromiseToPay',
          entityId: ptp.id,
          entityLabel: `PTP ${ptp.id}`,
          userId: null,
          systemActor: 'cron:ptp-evaluator',
          changes: { totalPaid, amountPaise: ptp.amountPaise, mostRecentPaymentId },
        },
      })

      logger.info('ptp.evaluated', { ptpId: ptp.id, newStatus, businessId })
    } catch (e) {
      logger.error('ptp.evaluate_error', {
        ptpId: ptp.id,
        businessId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
}
