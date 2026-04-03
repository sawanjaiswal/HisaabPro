/**
 * Approvals — list and review approval requests
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { ReviewApprovalInput } from '../../schemas/settings.schemas.js'

export async function listApprovals(
  businessId: string,
  status?: string,
  page = 1,
  limit = 50,
) {
  const where: Record<string, unknown> = { businessId }
  if (status) where.status = status

  const safePage = Math.max(1, page)
  const safeLimit = Math.min(Math.max(1, limit), 200)

  const [entries, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      select: {
        id: true, type: true, entityType: true, entityId: true,
        requestedChanges: true, status: true, reviewedAt: true,
        reviewNote: true, expiresAt: true, createdAt: true,
        requester: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.approvalRequest.count({ where }),
  ])

  return {
    entries,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
  }
}

export async function reviewApproval(
  businessId: string,
  approvalId: string,
  userId: string,
  data: ReviewApprovalInput
) {
  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, businessId, status: 'PENDING' },
    select: { id: true, expiresAt: true },
  })
  if (!approval) throw notFoundError('Approval')
  if (approval.expiresAt < new Date()) throw validationError('Approval has expired')

  return prisma.approvalRequest.update({
    where: { id: approvalId },
    data: {
      status: data.action === 'APPROVE' ? 'APPROVED' : 'DENIED',
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNote: data.reviewNote || null,
    },
    select: {
      id: true, type: true, status: true,
      reviewedAt: true, reviewNote: true,
    },
  })
}
