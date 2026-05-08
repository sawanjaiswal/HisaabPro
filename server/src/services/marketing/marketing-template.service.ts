/**
 * Marketing Template Service — CRUD (PR2)
 * Business-scoped. OWNER/ADMIN only for delete.
 */

import { prisma } from '../../lib/prisma.js'
import { sendError } from '../../lib/response.js'
import type { Response } from 'express'
import type {
  CreateMarketingTemplateInput,
  UpdateMarketingTemplateInput,
} from './marketing-template.validators.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listTemplates(
  businessId: string,
  channel?: string,
  cursor?: string,
  limit = 20,
) {
  const where = {
    businessId,
    isDeleted: false,
    ...(channel ? { channel } : {}),
  }

  const templates = await prisma.marketingTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  const hasMore = templates.length > limit
  const data = hasMore ? templates.slice(0, limit) : templates
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null

  return { data, nextCursor }
}

// ---------------------------------------------------------------------------
// Get one
// ---------------------------------------------------------------------------

export async function getTemplate(id: string, businessId: string) {
  return prisma.marketingTemplate.findFirst({
    where: { id, businessId, isDeleted: false },
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createTemplate(
  businessId: string,
  userId: string,
  input: CreateMarketingTemplateInput,
) {
  return prisma.marketingTemplate.create({
    data: {
      businessId,
      createdBy: userId,
      name: input.name,
      channel: input.channel,
      bodyEn: input.bodyEn,
      bodyHi: input.bodyHi,
      dltTemplateId: input.dltTemplateId,
      waTemplateName: input.waTemplateName,
      variables: input.variables ?? [],
      updatedAt: new Date(),
    },
  })
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateTemplate(
  id: string,
  businessId: string,
  input: UpdateMarketingTemplateInput,
) {
  const existing = await prisma.marketingTemplate.findFirst({
    where: { id, businessId, isDeleted: false },
  })
  if (!existing) return null

  return prisma.marketingTemplate.update({
    where: { id },
    data: { ...input, updatedAt: new Date() },
  })
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export async function deleteTemplate(
  id: string,
  businessId: string,
  res: Response,
): Promise<boolean> {
  const existing = await prisma.marketingTemplate.findFirst({
    where: { id, businessId, isDeleted: false },
  })
  if (!existing) {
    sendError(res, 'Template not found', 'NOT_FOUND', 404)
    return false
  }

  // Block if template is used by any active campaign
  const activeCampaign = await prisma.marketingCampaign.findFirst({
    where: { templateId: id, isDeleted: false, status: { in: ['DRAFT', 'SCHEDULED', 'RUNNING'] } },
  })
  if (activeCampaign) {
    sendError(res, 'Template is in use by an active campaign', 'TEMPLATE_IN_USE', 409)
    return false
  }

  await prisma.marketingTemplate.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() },
  })

  logger.info('marketing.template.deleted', { templateId: id, businessId })
  return true
}
