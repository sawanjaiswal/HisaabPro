/**
 * Invoice Template — CRUD service (list / get / create / update / softDelete /
 * duplicate). Every query is scoped by businessId; a cross-tenant / missing /
 * soft-deleted target returns 404 TEMPLATE_NOT_FOUND (no existence oracle).
 *
 * Create + duplicate run in a $transaction: count-cap (≤20) re-checked under the
 * tx, then the row + an auditLog row are written atomically. Analytics events
 * are emitted POST-commit (side-effect rule).
 */

import { prisma } from '../../lib/prisma.js'
import { analyticsEmit } from '../../lib/analytics.js'
import {
  MAX_TEMPLATES,
  templateNotFoundError,
  templateLimitReachedError,
  templateIsDefaultError,
} from './template.constants.js'
import {
  toTemplateSummary,
  toInvoiceTemplate,
  type TemplateRow,
} from './template.mapper.js'
import type { InvoiceTemplateDTO, TemplateSummary } from './template.types.js'
import type { CreateTemplateInput, UpdateTemplateInput } from '../../schemas/invoice-template.schema.js'
import type { Prisma } from '@prisma/client'

const FULL_INCLUDE = { defaultFor: { select: { documentType: true } } } as const

/** GET /api/templates — summaries (config excluded). */
export async function listTemplates(businessId: string): Promise<TemplateSummary[]> {
  const rows = await prisma.invoiceTemplate.findMany({
    where: { businessId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      baseTemplate: true,
      isActive: true,
      updatedAt: true,
      defaultFor: { select: { documentType: true } },
    },
  })
  return rows.map(toTemplateSummary)
}

/** GET /api/templates/:id — full entity (404 on scope miss). */
export async function getTemplate(businessId: string, id: string): Promise<InvoiceTemplateDTO> {
  const row = await prisma.invoiceTemplate.findFirst({
    where: { id, businessId },
    include: FULL_INCLUDE,
  })
  if (!row) throw templateNotFoundError()
  return toInvoiceTemplate(row as unknown as TemplateRow)
}

/** POST /api/templates — capped, audited create. */
export async function createTemplate(
  businessId: string,
  userId: string,
  data: CreateTemplateInput,
): Promise<InvoiceTemplateDTO> {
  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.invoiceTemplate.count({ where: { businessId } })
    if (count >= MAX_TEMPLATES) {
      analyticsEmit('template_limit_hit', { businessId })
      throw templateLimitReachedError()
    }
    const row = await tx.invoiceTemplate.create({
      data: {
        businessId,
        name: data.name,
        baseTemplate: data.baseTemplate,
        config: data.config as Prisma.InputJsonValue,
        printSettings: data.printSettings as Prisma.InputJsonValue,
      },
      include: FULL_INCLUDE,
    })
    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'InvoiceTemplate',
        entityId: row.id,
        entityLabel: data.name.slice(0, 120),
        userId,
        action: 'CREATE',
        changes: { baseTemplate: data.baseTemplate },
      },
    })
    return row
  })

  analyticsEmit('template_created', { businessId, baseTemplate: created.baseTemplate })
  return toInvoiceTemplate(created as unknown as TemplateRow)
}

/** PUT /api/templates/:id — partial merge (only supplied fields). */
export async function updateTemplate(
  businessId: string,
  userId: string,
  id: string,
  data: UpdateTemplateInput,
): Promise<InvoiceTemplateDTO> {
  const existing = await prisma.invoiceTemplate.findFirst({
    where: { id, businessId },
    select: { id: true },
  })
  if (!existing) throw templateNotFoundError()

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.baseTemplate !== undefined && { baseTemplate: data.baseTemplate }),
        ...(data.config !== undefined && { config: data.config as Prisma.InputJsonValue }),
        ...(data.printSettings !== undefined && {
          printSettings: data.printSettings as Prisma.InputJsonValue,
        }),
      },
      include: FULL_INCLUDE,
    })
    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'InvoiceTemplate',
        entityId: id,
        entityLabel: null,
        userId,
        action: 'UPDATE',
        changes: { fields: Object.keys(data) },
      },
    })
    return row
  })

  analyticsEmit('template_updated', { templateId: id })
  return toInvoiceTemplate(updated as unknown as TemplateRow)
}

/** DELETE /api/templates/:id — soft-delete (blocked while a default). */
export async function softDeleteTemplate(
  businessId: string,
  userId: string,
  id: string,
): Promise<{ id: string }> {
  const existing = await prisma.invoiceTemplate.findFirst({
    where: { id, businessId },
    select: { id: true, _count: { select: { defaultFor: true } } },
  })
  if (!existing) throw templateNotFoundError()
  if (existing._count.defaultFor > 0) throw templateIsDefaultError()

  await prisma.$transaction(async (tx) => {
    await tx.invoiceTemplate.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), isActive: false },
    })
    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'InvoiceTemplate',
        entityId: id,
        entityLabel: null,
        userId,
        action: 'DELETE',
        changes: { mode: 'soft' },
      },
    })
  })

  analyticsEmit('template_deleted', { templateId: id })
  return { id }
}

/** POST /api/templates/:id/duplicate — clone (no defaults, name + " (Copy)"). */
export async function duplicateTemplate(
  businessId: string,
  userId: string,
  id: string,
): Promise<InvoiceTemplateDTO> {
  const source = await prisma.invoiceTemplate.findFirst({
    where: { id, businessId },
    select: { name: true, baseTemplate: true, config: true, printSettings: true },
  })
  if (!source) throw templateNotFoundError()

  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.invoiceTemplate.count({ where: { businessId } })
    if (count >= MAX_TEMPLATES) {
      analyticsEmit('template_limit_hit', { businessId })
      throw templateLimitReachedError()
    }
    const row = await tx.invoiceTemplate.create({
      data: {
        businessId,
        name: `${source.name} (Copy)`.slice(0, 100),
        baseTemplate: source.baseTemplate,
        config: source.config as Prisma.InputJsonValue,
        printSettings: source.printSettings as Prisma.InputJsonValue,
      },
      include: FULL_INCLUDE,
    })
    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'InvoiceTemplate',
        entityId: row.id,
        entityLabel: row.name.slice(0, 120),
        userId,
        action: 'CREATE',
        changes: { duplicatedFrom: id },
      },
    })
    return row
  })

  analyticsEmit('template_duplicated', { fromTemplateId: id, toTemplateId: created.id })
  return toInvoiceTemplate(created as unknown as TemplateRow)
}
