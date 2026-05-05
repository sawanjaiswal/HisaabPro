/**
 * Job Service — softDeleteJob
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'

export async function softDeleteJob(
  businessId: string,
  jobId: string,
  userId: string
) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true, status: true, invoiceId: true, isDeleted: true },
  })
  if (!job) throw notFoundError('Job')

  // Idempotent: already deleted → return success
  if (job.isDeleted) {
    return { id: jobId, isDeleted: true }
  }

  // Cannot delete a job that is invoiced (would strand the invoice)
  if (job.status === 'INVOICED' && job.invoiceId !== null) {
    throw validationError('Cannot delete an invoiced job — cancel the invoice first')
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    },
  })

  return { id: jobId, isDeleted: true }
}
