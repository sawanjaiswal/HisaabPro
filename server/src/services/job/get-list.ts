/**
 * Job Service — getJob + listJobs
 */

import { prisma } from '../../lib/prisma.js'
import type { ListJobsQuery } from '../../schemas/job.schemas.js'
import { JOB_LIST_SELECT, JOB_DETAIL_SELECT } from './selects.js'
import { notFoundError } from '../../lib/errors.js'

export async function getJob(businessId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId, isDeleted: false },
    select: JOB_DETAIL_SELECT,
  })
  if (!job) throw notFoundError('Job')
  return job
}

export async function listJobs(businessId: string, query: ListJobsQuery) {
  const { status, partyId, q, scheduledFrom, scheduledTo, cursor, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    isDeleted: false,
  }

  if (status) where.status = status
  if (partyId) where.partyId = partyId

  if (scheduledFrom || scheduledTo) {
    where.scheduledAt = {
      ...(scheduledFrom && { gte: new Date(scheduledFrom) }),
      ...(scheduledTo && { lte: new Date(scheduledTo) }),
    }
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { party: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }

  // Cursor pagination on (updatedAt, id)
  if (cursor) {
    const [cursorUpdatedAt, cursorId] = cursor.split('_')
    where.OR = [
      { updatedAt: { lt: new Date(cursorUpdatedAt) } },
      { updatedAt: new Date(cursorUpdatedAt), id: { lt: cursorId } },
    ]
  }

  const items = await prisma.job.findMany({
    where,
    select: JOB_LIST_SELECT,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  })

  let nextCursor: string | null = null
  if (items.length > limit) {
    const last = items[limit - 1]
    nextCursor = `${last.updatedAt.toISOString()}_${last.id}`
    items.splice(limit)
  }

  return { items, nextCursor }
}
