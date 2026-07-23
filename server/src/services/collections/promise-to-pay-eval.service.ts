/**
 * Promise-to-Pay — list, markKept, and evaluateOpenPtps.
 * MB-7: evaluateOpenPtps writes AuditLog with userId=NULL, systemActor='cron:ptp-evaluator'.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { notifyPtpBroken } from '../notifications/notification-hooks.js'

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
export async function evaluateOpenPtps(
  businessId: string,
  asOf: Date,
) {
  const openPtps = await prisma.promiseToPay.findMany({
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

  // F-13: bulk-load allocations once per business (O(B), not O(B×N))
  const invoiceIds = openPtps.map((p) => p.invoiceId).filter((id): id is string => id !== null)
  const partyIds = openPtps.map((p) => p.partyId)
  const maxPromiseDate = openPtps.reduce(
    (max, p) => (p.promiseDate > max ? p.promiseDate : max),
    openPtps[0].promiseDate,
  )

  const bulkAllocations = await prisma.paymentAllocation.findMany({
    where: {
      payment: {
        businessId,
        date: { lte: maxPromiseDate },
        isDeleted: false,
      },
      ...(invoiceIds.length > 0 || partyIds.length > 0
        ? {
            OR: [
              ...(invoiceIds.length > 0 ? [{ invoiceId: { in: invoiceIds } }] : []),
              ...(partyIds.length > 0 ? [{ payment: { partyId: { in: partyIds } } }] : []),
            ],
          }
        : {}),
    },
    select: {
      amount: true,
      paymentId: true,
      invoiceId: true,
      payment: { select: { partyId: true, date: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const byInvoice = new Map<string, typeof bulkAllocations>()
  const byParty = new Map<string, typeof bulkAllocations>()
  for (const alloc of bulkAllocations) {
    if (alloc.invoiceId) {
      const arr = byInvoice.get(alloc.invoiceId) ?? []
      arr.push(alloc)
      byInvoice.set(alloc.invoiceId, arr)
    }
    const pid = alloc.payment.partyId
    if (pid) {
      const arr = byParty.get(pid) ?? []
      arr.push(alloc)
      byParty.set(pid, arr)
    }
  }

  for (const ptp of openPtps) {
    try {
      const allocations = ptp.invoiceId
        ? (byInvoice.get(ptp.invoiceId) ?? []).filter((a) => a.payment.date <= ptp.promiseDate)
        : (byParty.get(ptp.partyId) ?? []).filter((a) => a.payment.date <= ptp.promiseDate)

      const totalPaid = allocations.reduce((s, a) => s + a.amount, 0)
      const isKept = totalPaid >= ptp.amountPaise
      const newStatus = isKept ? 'KEPT' : 'BROKEN'
      const mostRecentPaymentId = allocations[0]?.paymentId ?? null

      // Each PTP's update + audit gets its own tiny $transaction so one bad
      // PTP row doesn't roll back the others for the same business.
      await prisma.$transaction(async (tx) => {
        await tx.promiseToPay.update({
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

        await tx.auditLog.create({
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
      })
      logger.info('ptp.evaluated', { ptpId: ptp.id, newStatus, businessId })
      // Sync try/catch can't catch this fire-and-forget rejection — attribute it.
      if (!isKept)
        void notifyPtpBroken({ businessId, ptpId: ptp.id, amountPaise: ptp.amountPaise, promiseDate: ptp.promiseDate }).catch((e) =>
          logger.error('ptp.notify_broken.failed', { ptpId: ptp.id, businessId, error: String(e) })
        )
    } catch (e) {
      logger.error('ptp.evaluate_error', { ptpId: ptp.id, businessId, error: e instanceof Error ? e.message : String(e) })
    }
  }
}
