/**
 * Read/write queries for GST reconciliation records.
 * Covers: get, list (paginated), entries (paginated), delete.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import type { ReconciliationEntryFilter, ListReconciliationsQuery } from '../../schemas/reconciliation.schemas.js'

export async function getReconciliation(businessId: string, reconId: string) {
  const recon = await prisma.gstReconciliation.findFirst({
    where: { id: reconId, businessId },
  })
  if (!recon) throw notFoundError('Reconciliation')
  return recon
}

export async function getReconciliationEntries(
  businessId: string,
  reconId: string,
  filters: ReconciliationEntryFilter,
) {
  // Verify ownership
  const recon = await prisma.gstReconciliation.findFirst({
    where: { id: reconId, businessId },
    select: { id: true },
  })
  if (!recon) throw notFoundError('Reconciliation')

  const { matchStatus, page, limit } = filters
  const skip = (page - 1) * limit

  const [entries, total] = await Promise.all([
    prisma.gstReconciliationEntry.findMany({
      where: {
        reconciliationId: reconId,
        ...(matchStatus ? { matchStatus } : {}),
      },
      orderBy: { matchStatus: 'asc' },
      skip,
      take: limit,
    }),
    prisma.gstReconciliationEntry.count({
      where: {
        reconciliationId: reconId,
        ...(matchStatus ? { matchStatus } : {}),
      },
    }),
  ])

  return { entries, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function listReconciliations(
  businessId: string,
  filters: ListReconciliationsQuery,
) {
  const { period, status, page, limit } = filters
  const skip = (page - 1) * limit

  const where = {
    businessId,
    ...(period ? { period } : {}),
    ...(status ? { status } : {}),
  }

  const [reconciliations, total] = await Promise.all([
    prisma.gstReconciliation.findMany({
      where,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: {
        id: true,
        period: true,
        reconType: true,
        status: true,
        totalInvoices: true,
        matchedCount: true,
        mismatchedCount: true,
        missingInGstrCount: true,
        extraInGstrCount: true,
        totalBookValue: true,
        totalGstrValue: true,
        differenceValue: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.gstReconciliation.count({ where }),
  ])

  return { reconciliations, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function deleteReconciliation(businessId: string, reconId: string) {
  const recon = await prisma.gstReconciliation.findFirst({
    where: { id: reconId, businessId },
    select: { id: true },
  })
  if (!recon) throw notFoundError('Reconciliation')

  // Entries cascade via onDelete: Cascade on the relation
  await prisma.gstReconciliation.delete({ where: { id: reconId } })
}
