/**
 * Campaign Service — CRUD (PR4)
 * Business-scoped. Idempotency-Key on POST.
 */

import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { segmentFilterSchema } from './campaign-segment.types.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(['WHATSAPP', 'SMS']),
  templateId: z.string().min(1),
  segmentFilter: segmentFilterSchema.optional().default({ partyType: 'CUSTOMER' }),
  scheduledAt: z.string().datetime().optional(),
  defaultVars: z.record(z.string()).optional().default({}),
}).strict()

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  templateId: z.string().min(1).optional(),
  segmentFilter: segmentFilterSchema.optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  defaultVars: z.record(z.string()).optional(),
}).strict()

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listCampaigns(
  businessId: string,
  status?: string,
  cursor?: string,
  limit = 20,
) {
  const where = {
    businessId,
    isDeleted: false,
    ...(status ? { status: status as 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' } : {}),
  }

  const campaigns = await prisma.marketingCampaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  const hasMore = campaigns.length > limit
  const data = hasMore ? campaigns.slice(0, limit) : campaigns
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null

  return { data, nextCursor }
}

// ---------------------------------------------------------------------------
// Get one
// ---------------------------------------------------------------------------

export async function getCampaign(id: string, businessId: string) {
  return prisma.marketingCampaign.findFirst({
    where: { id, businessId, isDeleted: false },
    include: { template: true },
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createCampaign(
  businessId: string,
  userId: string,
  input: CreateCampaignInput,
) {
  // Verify template belongs to this business
  const template = await prisma.marketingTemplate.findFirst({
    where: { id: input.templateId, businessId, isDeleted: false },
  })
  if (!template) {
    throw Object.assign(new Error('Template not found'), { statusCode: 404, code: 'NOT_FOUND' })
  }

  if (template.channel !== input.channel) {
    throw Object.assign(new Error('Template channel must match campaign channel'), { statusCode: 400, code: 'CHANNEL_MISMATCH' })
  }

  return prisma.marketingCampaign.create({
    data: {
      businessId,
      createdBy: userId,
      name: input.name,
      channel: input.channel,
      templateId: input.templateId,
      segmentFilter: input.segmentFilter,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      defaultVars: input.defaultVars,
      updatedAt: new Date(),
    },
  })
}

// ---------------------------------------------------------------------------
// Update (DRAFT only)
// ---------------------------------------------------------------------------

export async function updateCampaign(
  id: string,
  businessId: string,
  input: UpdateCampaignInput,
) {
  const existing = await prisma.marketingCampaign.findFirst({
    where: { id, businessId, isDeleted: false },
  })
  if (!existing) return null

  if (existing.status !== 'DRAFT') {
    throw Object.assign(new Error('Only DRAFT campaigns can be edited'), { statusCode: 409, code: 'INVALID_TRANSITION' })
  }

  if (input.templateId) {
    const template = await prisma.marketingTemplate.findFirst({
      where: { id: input.templateId, businessId, isDeleted: false },
    })
    if (!template) {
      throw Object.assign(new Error('Template not found'), { statusCode: 404, code: 'NOT_FOUND' })
    }
  }

  return prisma.marketingCampaign.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.templateId ? { templateId: input.templateId } : {}),
      ...(input.segmentFilter !== undefined ? { segmentFilter: input.segmentFilter } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null } : {}),
      ...(input.defaultVars ? { defaultVars: input.defaultVars } : {}),
      updatedAt: new Date(),
    },
  })
}

// ---------------------------------------------------------------------------
// Get recipients
// ---------------------------------------------------------------------------

export async function getCampaignRecipients(
  campaignId: string,
  businessId: string,
  status?: string,
  cursor?: string,
  limit = 50,
) {
  // Verify ownership
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, businessId },
  })
  if (!campaign) return null

  const where = {
    campaignId,
    ...(status ? { status: status as 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED' } : {}),
  }

  const recipients = await prisma.marketingCampaignRecipient.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      partyId: true,
      status: true,
      skipReason: true,
      dispatchedAt: true,
      failedAt: true,
      costPaise: true,
      createdAt: true,
      // phone intentionally omitted from list response
    },
  })

  const hasMore = recipients.length > limit
  const data = hasMore ? recipients.slice(0, limit) : recipients
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null

  return { data, nextCursor }
}

logger.debug('campaign.service.loaded')
