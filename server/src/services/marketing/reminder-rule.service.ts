/**
 * Reminder Rule Service — CRUD (PR5)
 * OWNER/ADMIN for toggle/delete. Business-scoped.
 */

import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { segmentFilterSchema } from './campaign-segment.types.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const createReminderRuleSchema = z.object({
  name: z.string().min(1).max(100),
  trigger: z.enum(['BIRTHDAY', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'FOLLOWUP', 'INACTIVE', 'ORDER_DELIVERY']),
  offsetDays: z.number().int().min(0).max(90),
  channel: z.enum(['WHATSAPP', 'SMS']),
  templateId: z.string().min(1),
  segmentFilter: segmentFilterSchema.optional().default({ partyType: 'CUSTOMER' }),
  quietHoursStart: z.string().regex(HHMM_RE).optional(),
  quietHoursEnd: z.string().regex(HHMM_RE).optional(),
}).strict()

export const updateReminderRuleSchema = createReminderRuleSchema.partial().strict()

export type CreateReminderRuleInput = z.infer<typeof createReminderRuleSchema>
export type UpdateReminderRuleInput = z.infer<typeof updateReminderRuleSchema>

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listReminderRules(
  businessId: string,
  enabled?: boolean,
  cursor?: string,
  limit = 20,
) {
  const where = {
    businessId,
    isDeleted: false,
    ...(enabled !== undefined ? { enabled } : {}),
  }

  const rules = await prisma.reminderRule.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  const hasMore = rules.length > limit
  const data = hasMore ? rules.slice(0, limit) : rules
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null

  return { data, nextCursor }
}

// ---------------------------------------------------------------------------
// Get one
// ---------------------------------------------------------------------------

export async function getReminderRule(id: string, businessId: string) {
  return prisma.reminderRule.findFirst({
    where: { id, businessId, isDeleted: false },
    include: { template: true },
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createReminderRule(
  businessId: string,
  userId: string,
  input: CreateReminderRuleInput,
) {
  const template = await prisma.marketingTemplate.findFirst({
    where: { id: input.templateId, businessId, isDeleted: false },
  })
  if (!template) {
    throw Object.assign(new Error('Template not found'), { statusCode: 404, code: 'NOT_FOUND' })
  }

  return prisma.reminderRule.create({
    data: {
      businessId,
      createdBy: userId,
      name: input.name,
      trigger: input.trigger,
      offsetDays: input.offsetDays,
      channel: input.channel,
      templateId: input.templateId,
      segmentFilter: input.segmentFilter,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
      updatedAt: new Date(),
    },
  })
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateReminderRule(
  id: string,
  businessId: string,
  input: UpdateReminderRuleInput,
) {
  const existing = await prisma.reminderRule.findFirst({
    where: { id, businessId, isDeleted: false },
  })
  if (!existing) return null

  if (input.templateId) {
    const template = await prisma.marketingTemplate.findFirst({
      where: { id: input.templateId, businessId, isDeleted: false },
    })
    if (!template) {
      throw Object.assign(new Error('Template not found'), { statusCode: 404, code: 'NOT_FOUND' })
    }
  }

  return prisma.reminderRule.update({
    where: { id },
    data: { ...input, updatedAt: new Date() },
  })
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export async function deleteReminderRule(id: string, businessId: string): Promise<boolean> {
  const existing = await prisma.reminderRule.findFirst({
    where: { id, businessId, isDeleted: false },
  })
  if (!existing) return false

  await prisma.$transaction([
    // Cancel pending instances
    prisma.reminderInstance.updateMany({
      where: { ruleId: id, status: 'PENDING' },
      data: { status: 'SKIPPED', skipReason: 'rule_deleted', updatedAt: new Date() },
    }),
    // Soft-delete rule
    prisma.reminderRule.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), enabled: false, updatedAt: new Date() },
    }),
  ])

  logger.info('marketing.reminder_rule.deleted', { ruleId: id, businessId })
  return true
}

// ---------------------------------------------------------------------------
// Toggle enable/disable
// ---------------------------------------------------------------------------

export async function toggleReminderRule(id: string, businessId: string) {
  const existing = await prisma.reminderRule.findFirst({
    where: { id, businessId, isDeleted: false },
  })
  if (!existing) return null

  const newEnabled = !existing.enabled

  if (!newEnabled) {
    // Cancel pending instances when disabling
    await prisma.reminderInstance.updateMany({
      where: { ruleId: id, status: 'PENDING' },
      data: { status: 'SKIPPED', skipReason: 'rule_disabled', updatedAt: new Date() },
    })
  }

  return prisma.reminderRule.update({
    where: { id },
    data: { enabled: newEnabled, updatedAt: new Date() },
  })
}
