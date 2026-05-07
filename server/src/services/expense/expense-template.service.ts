/**
 * Expense Template Service — CRUD for recurring expense templates.
 * All operations are scoped by businessId.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { computeNextRunDate } from './recurring.dates.js'
import type { CreateTemplateInput, UpdateTemplateInput } from '../../schemas/expenses-upgrade.schemas.js'

// ── Types exported for routes ──────────────────────────────────────────────

export interface TemplateItem {
  id: string
  businessId: string
  categoryId: string
  category: { id: string; name: string; icon: string | null; color: string } | null
  amountPaise: number
  frequency: string
  dayOfMonth: number | null
  dayOfWeek: number | null
  nextRunDate: Date
  lastRunDate: Date | null
  paymentMode: string
  partyId: string | null
  note: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const TEMPLATE_SELECT = {
  id: true,
  businessId: true,
  categoryId: true,
  category: { select: { id: true, name: true, icon: true, color: true } },
  amountPaise: true,
  frequency: true,
  dayOfMonth: true,
  dayOfWeek: true,
  nextRunDate: true,
  lastRunDate: true,
  paymentMode: true,
  partyId: true,
  note: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

// ── Public API ─────────────────────────────────────────────────────────────

export async function listTemplates(businessId: string): Promise<TemplateItem[]> {
  return prisma.expenseTemplate.findMany({
    where: { businessId, isDeleted: false },
    select: TEMPLATE_SELECT,
    orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }],
    take: 200,
  })
}

export async function getTemplate(businessId: string, id: string): Promise<TemplateItem> {
  const t = await prisma.expenseTemplate.findFirst({
    where: { id, businessId, isDeleted: false },
    select: TEMPLATE_SELECT,
  })
  if (!t) throw notFoundError('ExpenseTemplate')
  return t
}

export async function createTemplate(
  businessId: string,
  userId: string,
  input: CreateTemplateInput,
): Promise<TemplateItem> {
  // Validate category belongs to business
  const category = await prisma.expenseCategory.findFirst({
    where: { id: input.categoryId, businessId, isActive: true, isDeleted: false },
    select: { id: true },
  })
  if (!category) throw validationError('Expense category not found or inactive')

  // Validate frequency + field combos (belt-and-suspenders beyond Zod)
  validateFrequencyFields(input.frequency, input.dayOfMonth, input.dayOfWeek)

  const template = await prisma.expenseTemplate.create({
    data: {
      businessId,
      categoryId: input.categoryId,
      amountPaise: input.amountPaise,
      frequency: input.frequency,
      dayOfMonth: input.dayOfMonth ?? null,
      dayOfWeek: input.dayOfWeek ?? null,
      nextRunDate: input.nextRunDate,
      paymentMode: input.paymentMode,
      partyId: input.partyId ?? null,
      note: input.note ?? null,
      createdBy: userId,
    },
    select: TEMPLATE_SELECT,
  })

  return template
}

export async function updateTemplate(
  businessId: string,
  id: string,
  input: UpdateTemplateInput,
): Promise<TemplateItem> {
  const existing = await prisma.expenseTemplate.findFirst({
    where: { id, businessId, isDeleted: false },
    select: { id: true, frequency: true, dayOfMonth: true, dayOfWeek: true },
  })
  if (!existing) throw notFoundError('ExpenseTemplate')

  // When frequency is changing, validate the new combo
  const freq = input.frequency ?? existing.frequency
  const dom = input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth
  const dow = input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek
  validateFrequencyFields(freq as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY', dom ?? undefined, dow ?? undefined)

  return prisma.expenseTemplate.update({
    where: { id },
    data: {
      ...(input.amountPaise !== undefined && { amountPaise: input.amountPaise }),
      ...(input.frequency !== undefined && { frequency: input.frequency }),
      ...(input.dayOfMonth !== undefined && { dayOfMonth: input.dayOfMonth }),
      ...(input.dayOfWeek !== undefined && { dayOfWeek: input.dayOfWeek }),
      ...(input.nextRunDate !== undefined && { nextRunDate: input.nextRunDate }),
      ...(input.paymentMode !== undefined && { paymentMode: input.paymentMode }),
      ...(input.partyId !== undefined && { partyId: input.partyId }),
      ...(input.note !== undefined && { note: input.note }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: TEMPLATE_SELECT,
  })
}

export async function deactivateTemplate(
  businessId: string,
  id: string,
): Promise<{ deleted: true }> {
  const existing = await prisma.expenseTemplate.findFirst({
    where: { id, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!existing) throw notFoundError('ExpenseTemplate')

  await prisma.expenseTemplate.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date(), isActive: false },
  })

  return { deleted: true }
}

// ── Internal helpers ───────────────────────────────────────────────────────

function validateFrequencyFields(
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): void {
  if (frequency === 'WEEKLY' && (dayOfWeek == null || dayOfWeek < 0 || dayOfWeek > 6)) {
    throw validationError('dayOfWeek (0-6) required for WEEKLY frequency')
  }
  if (frequency === 'MONTHLY' && (dayOfMonth == null || dayOfMonth < 1 || dayOfMonth > 28)) {
    throw validationError('dayOfMonth (1-28) required for MONTHLY frequency')
  }
  if (frequency === 'YEARLY' && (dayOfMonth == null || dayOfMonth < 1 || dayOfMonth > 28)) {
    throw validationError('dayOfMonth (1-28) required for YEARLY frequency')
  }
}

// Re-export computeNextRunDate so callers can use it without importing dates module
export { computeNextRunDate }
