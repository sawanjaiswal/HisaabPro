/**
 * Job Service — transitionJob (server-enforced state machine)
 */

import { type JobStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { assertTransitionAllowed } from './helpers.js'
import { JOB_DETAIL_SELECT } from './selects.js'

export async function transitionJob(
  businessId: string,
  jobId: string,
  userId: string,
  toStatus: JobStatus,
  reason?: string
) {
  // INVOICED is only reachable via convert-to-invoice, not this endpoint
  if (toStatus === 'INVOICED') {
    throw validationError('Use convert-to-invoice to mark a job as INVOICED')
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId, isDeleted: false },
    select: { id: true, status: true },
  })
  if (!job) throw notFoundError('Job')

  // No-op if already at target status
  if (job.status === toStatus) {
    const current = await prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      select: JOB_DETAIL_SELECT,
    })
    return current
  }

  assertTransitionAllowed(job.status as JobStatus, toStatus)

  const now = new Date()
  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: toStatus,
      updatedBy: userId,
      ...(toStatus === 'COMPLETED' && { completedAt: now }),
      ...(toStatus === 'CANCELLED' && { cancelledAt: now, cancelReason: reason ?? null }),
    },
    select: JOB_DETAIL_SELECT,
  })

  return updated
}
