/**
 * Job Service — createJob
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { generateNextNumber } from '../document-number.service.js'
import type { CreateJobInput } from '../../schemas/job.schemas.js'
import { JOB_DETAIL_SELECT } from './selects.js'
import logger from '../../lib/logger.js'

function computeItemTotal(quantity: string, ratePaise: number, discountPaise: number): number {
  const qty = parseFloat(quantity)
  return Math.round(qty * ratePaise) - discountPaise
}

export async function createJob(
  businessId: string,
  userId: string,
  data: CreateJobInput
) {
  // Idempotency: if clientId already exists for this business, return existing
  if (data.clientId) {
    const existing = await prisma.job.findFirst({
      where: { clientId: data.clientId, businessId, isDeleted: false },
      select: JOB_DETAIL_SELECT,
    })
    if (existing) {
      logger.info('Job clientId replay — returning existing', { clientId: data.clientId, businessId })
      return existing
    }
  }

  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId, isActive: true },
    select: { id: true },
  })
  if (!party) throw notFoundError('Party')

  // Compute item totals
  const itemsWithTotals = data.items.map((item, i) => ({
    sortOrder: i,
    productId: item.productId ?? null,
    kind: item.kind,
    description: item.description,
    quantity: item.quantity,
    ratePaise: item.ratePaise,
    discountPaise: item.discountPaise,
    totalPaise: computeItemTotal(item.quantity, item.ratePaise, item.discountPaise),
  }))

  const subtotalPaise = itemsWithTotals.reduce((sum, it) => sum + it.totalPaise, 0)
  // Clamp grand total to match FE jobs.utils.ts:39 (per-line stays unclamped so a
  // heavy discount on one line can offset another, identical to FE aggregation).
  const totalPaise = Math.max(0, subtotalPaise)

  const result = await prisma.$transaction(async (tx) => {
    // Assign job number immediately (QUOTED → numbered on create)
    const numberData = await generateNextNumber(tx, businessId, 'JOB', new Date())

    const job = await tx.job.create({
      data: {
        businessId,
        partyId: data.partyId,
        title: data.title,
        description: data.description ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        estimatedHours: data.estimatedHours ?? null,
        actualHours: data.actualHours ?? null,
        subtotalPaise,
        discountPaise: 0,
        totalPaise,
        jobNumber: numberData.documentNumber,
        sequenceNumber: numberData.sequenceNumber,
        financialYear: numberData.financialYear,
        clientId: data.clientId ?? null,
        createdBy: userId,
        items: {
          createMany: {
            data: itemsWithTotals,
          },
        },
      },
      select: JOB_DETAIL_SELECT,
    })

    return job
  })

  return result
}
