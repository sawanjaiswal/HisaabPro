/**
 * Job Service — STATUS_TRANSITIONS table, assertTransitionAllowed, requireJob
 */

import { type JobStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { JOB_DETAIL_SELECT } from './selects.js'

/** Valid status transitions: Map<from, Set<to>> */
export const STATUS_TRANSITIONS = new Map<JobStatus, Set<JobStatus>>([
  ['QUOTED',      new Set<JobStatus>(['SCHEDULED', 'CANCELLED'])],
  ['SCHEDULED',   new Set<JobStatus>(['QUOTED', 'IN_PROGRESS', 'CANCELLED'])],
  ['IN_PROGRESS', new Set<JobStatus>(['SCHEDULED', 'COMPLETED', 'CANCELLED'])],
  ['COMPLETED',   new Set<JobStatus>(['IN_PROGRESS', 'CANCELLED'])],
  ['INVOICED',    new Set<JobStatus>()],
  ['CANCELLED',   new Set<JobStatus>()],
])

export function assertTransitionAllowed(from: JobStatus, to: JobStatus): void {
  const allowed = STATUS_TRANSITIONS.get(from)
  if (!allowed || !allowed.has(to)) {
    throw validationError(
      `Invalid transition from ${from} to ${to}`,
      { code: 'INVALID_TRANSITION', from, to }
    )
  }
}

type JobDetailSelect = typeof JOB_DETAIL_SELECT

export async function requireJob(
  businessId: string,
  jobId: string,
  extraSelect?: Record<string, unknown>
) {
  const select = extraSelect
    ? { ...JOB_DETAIL_SELECT, ...extraSelect }
    : JOB_DETAIL_SELECT as JobDetailSelect

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId, isDeleted: false },
    select,
  })
  if (!job) throw notFoundError('Job')
  return job
}
