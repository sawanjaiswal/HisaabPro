/**
 * Custom field definition services.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../../lib/errors.js'
import type {
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
} from '../../schemas/party.schemas.js'

export const MAX_CUSTOM_FIELDS_PER_ENTITY = 20

export async function createCustomField(
  businessId: string,
  data: CreateCustomFieldInput
) {
  // Enforce per-entity-type limit
  const existing = await prisma.customFieldDefinition.count({
    where: { businessId, entityType: data.entityType },
  })
  if (existing >= MAX_CUSTOM_FIELDS_PER_ENTITY) {
    throw validationError(
      `Maximum ${MAX_CUSTOM_FIELDS_PER_ENTITY} custom fields allowed per entity type`
    )
  }

  try {
    return await prisma.customFieldDefinition.create({
      data: {
        businessId,
        name: data.name,
        fieldType: data.fieldType,
        options: data.options ?? [],
        required: data.required,
        showOnInvoice: data.showOnInvoice,
        entityType: data.entityType,
        sortOrder: data.sortOrder,
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        fieldType: true,
        options: true,
        required: true,
        showOnInvoice: true,
        entityType: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Custom field "${data.name}" already exists for this entity type`)
      }
    }
    throw err
  }
}

export async function listCustomFields(businessId: string, entityType?: string) {
  return prisma.customFieldDefinition.findMany({
    where: {
      businessId,
      ...(entityType && { entityType }),
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      fieldType: true,
      options: true,
      required: true,
      showOnInvoice: true,
      entityType: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 100,
  })
}

export async function updateCustomField(
  businessId: string,
  fieldId: string,
  data: UpdateCustomFieldInput
) {
  const field = await prisma.customFieldDefinition.findFirst({
    where: { id: fieldId, businessId },
  })
  if (!field) throw notFoundError('Custom field')

  return prisma.customFieldDefinition.update({
    where: { id: fieldId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.options !== undefined && { options: data.options }),
      ...(data.required !== undefined && { required: data.required }),
      ...(data.showOnInvoice !== undefined && { showOnInvoice: data.showOnInvoice }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
    select: {
      id: true,
      name: true,
      fieldType: true,
      options: true,
      required: true,
      showOnInvoice: true,
      entityType: true,
      sortOrder: true,
      updatedAt: true,
    },
  })
}

export async function deleteCustomField(businessId: string, fieldId: string) {
  const field = await prisma.customFieldDefinition.findFirst({
    where: { id: fieldId, businessId },
  })
  if (!field) throw notFoundError('Custom field')

  // Cascade delete via Prisma schema (PartyCustomFieldValue has onDelete: Cascade)
  await prisma.customFieldDefinition.delete({ where: { id: fieldId } })
  return { deleted: true }
}
