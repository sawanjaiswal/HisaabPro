/**
 * Job Service — updateJob
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { UpdateJobInput } from '../../schemas/job.schemas.js'
import { JOB_DETAIL_SELECT } from './selects.js'

function computeItemTotal(quantity: string, ratePaise: number, discountPaise: number): number {
  const qty = parseFloat(quantity)
  return Math.round(qty * ratePaise) - discountPaise
}

export async function updateJob(
  businessId: string,
  jobId: string,
  userId: string,
  data: UpdateJobInput
) {
  const existing = await prisma.job.findFirst({
    where: { id: jobId, businessId, isDeleted: false },
    select: { id: true, status: true },
  })
  if (!existing) throw notFoundError('Job')

  if (existing.status === 'INVOICED') {
    throw validationError('Cannot edit an invoiced job')
  }
  if (existing.status === 'CANCELLED') {
    throw validationError('Cannot edit a cancelled job')
  }

  if (data.partyId) {
    const party = await prisma.party.findFirst({
      where: { id: data.partyId, businessId, isActive: true },
      select: { id: true },
    })
    if (!party) throw notFoundError('Party')
  }

  const result = await prisma.$transaction(async (tx) => {
    let subtotalPaise: number | undefined
    let totalPaise: number | undefined

    if (data.items) {
      const itemsWithTotals = data.items.map((item, i) => ({
        sortOrder: i,
        productId: item.productId ?? null,
        kind: item.kind ?? 'ITEM',
        description: item.description,
        quantity: item.quantity!,
        ratePaise: item.ratePaise!,
        discountPaise: item.discountPaise ?? 0,
        totalPaise: computeItemTotal(item.quantity!, item.ratePaise!, item.discountPaise ?? 0),
      }))

      subtotalPaise = itemsWithTotals.reduce((sum, it) => sum + it.totalPaise, 0)
      // Clamp grand total to match FE jobs.utils.ts:39 (per-line stays unclamped).
      totalPaise = Math.max(0, subtotalPaise)

      await tx.jobItem.deleteMany({ where: { jobId } })
      await tx.jobItem.createMany({
        data: itemsWithTotals.map(it => ({ ...it, jobId })),
      })
    }

    const updated = await tx.job.update({
      where: { id: jobId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.partyId !== undefined && { partyId: data.partyId }),
        ...(data.scheduledAt !== undefined && {
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        }),
        ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
        ...(data.actualHours !== undefined && { actualHours: data.actualHours }),
        ...(subtotalPaise !== undefined && { subtotalPaise }),
        ...(totalPaise !== undefined && { totalPaise }),
        updatedBy: userId,
      },
      select: JOB_DETAIL_SELECT,
    })

    return updated
  })

  return result
}
