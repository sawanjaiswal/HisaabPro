/**
 * Job Service — recycle bin: listDeletedJobs, restoreJob, permanentDeleteJob
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { JOB_LIST_SELECT } from './selects.js'

export async function listDeletedJobs(businessId: string) {
  const items = await prisma.job.findMany({
    where: { businessId, isDeleted: true },
    select: JOB_LIST_SELECT,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  return { items }
}

export async function restoreJob(businessId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId, isDeleted: true },
    select: { id: true },
  })
  if (!job) throw notFoundError('Job')

  await prisma.job.update({
    where: { id: jobId },
    data: { isDeleted: false, deletedAt: null, deletedBy: null },
  })

  return { id: jobId, isDeleted: false }
}

export async function permanentDeleteJob(businessId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true, isDeleted: true, invoiceId: true },
  })
  if (!job) throw notFoundError('Job')
  if (!job.isDeleted) {
    throw validationError('Job must be soft-deleted before permanent deletion')
  }
  if (job.invoiceId) {
    throw validationError('Cannot permanently delete an invoiced job')
  }

  await prisma.job.delete({ where: { id: jobId } })
  return { id: jobId, deleted: true }
}
