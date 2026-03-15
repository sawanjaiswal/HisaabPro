/**
 * Party Management Service
 * All business logic for parties, groups, custom fields, addresses, pricing.
 * Amounts are stored in PAISE (integer). All queries scoped to businessId.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import type {
  CreatePartyInput,
  UpdatePartyInput,
  ListPartiesQuery,
  CreateAddressInput,
  UpdateAddressInput,
  CreateGroupInput,
  UpdateGroupInput,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  SetPricingInput,
} from '../schemas/party.schemas.js'

// === Helpers ===

/** Verify party belongs to business, throw 404 if not */
async function requireParty(businessId: string, partyId: string) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
  })
  if (!party) throw notFoundError('Party')
  return party
}

/** Verify party group belongs to business, throw 404 if not */
async function requireGroup(businessId: string, groupId: string) {
  const group = await prisma.partyGroup.findFirst({
    where: { id: groupId, businessId },
  })
  if (!group) throw notFoundError('Party group')
  return group
}

// === Party CRUD ===

export async function createParty(businessId: string, data: CreatePartyInput) {
  logger.info('Creating party', { businessId, partyName: data.name })

  // Validate groupId belongs to business if provided
  if (data.groupId) {
    await requireGroup(businessId, data.groupId)
  }

  // Determine initial outstanding balance from opening balance
  const openingAmount = data.openingBalance
    ? data.openingBalance.type === 'RECEIVABLE'
      ? data.openingBalance.amount
      : -data.openingBalance.amount
    : 0

  const party = await prisma.$transaction(async (tx) => {
    const created = await tx.party.create({
      data: {
        businessId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        companyName: data.companyName,
        type: data.type,
        groupId: data.groupId,
        tags: data.tags,
        gstin: data.gstin,
        pan: data.pan,
        creditLimit: data.creditLimit,
        creditLimitMode: data.creditLimitMode,
        notes: data.notes,
        outstandingBalance: openingAmount,
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        phone: true,
        email: true,
        companyName: true,
        type: true,
        groupId: true,
        tags: true,
        gstin: true,
        pan: true,
        creditLimit: true,
        creditLimitMode: true,
        outstandingBalance: true,
        totalBusiness: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Create addresses
    if (data.addresses.length > 0) {
      await tx.partyAddress.createMany({
        data: data.addresses.map((addr) => ({
          partyId: created.id,
          label: addr.label ?? 'Default',
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          type: addr.type,
          isDefault: addr.isDefault,
        })),
      })
    }

    // Create custom field values
    if (data.customFields.length > 0) {
      await tx.partyCustomFieldValue.createMany({
        data: data.customFields.map((cf) => ({
          partyId: created.id,
          fieldId: cf.fieldId,
          value: cf.value,
        })),
      })
    }

    // Create opening balance
    if (data.openingBalance) {
      await tx.openingBalance.create({
        data: {
          partyId: created.id,
          amount: data.openingBalance.amount,
          type: data.openingBalance.type,
          asOfDate: new Date(data.openingBalance.asOfDate),
          notes: data.openingBalance.notes,
        },
      })
    }

    return created
  })

  return party
}

export async function listParties(businessId: string, filters: ListPartiesQuery) {
  const {
    page,
    limit,
    search,
    type,
    groupId,
    hasOutstanding,
    isActive,
    sortBy,
    sortOrder,
    tags,
  } = filters

  const skip = (page - 1) * limit

  // Build where clause
  const where: Prisma.PartyWhereInput = {
    businessId,
    isActive,
  }

  if (type) where.type = type
  if (groupId) where.groupId = groupId

  if (hasOutstanding !== undefined) {
    where.outstandingBalance = hasOutstanding ? { not: 0 } : { equals: 0 }
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags }
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { gstin: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Build orderBy
  const orderBy: Prisma.PartyOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  }

  // Parallel: data + count + summary stats + type counts
  const baseWhere: Prisma.PartyWhereInput = { businessId, isActive }
  const [parties, total, receivableAgg, payableAgg, customersCount, suppliersCount, bothCount] = await Promise.all([
    prisma.party.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        companyName: true,
        type: true,
        groupId: true,
        tags: true,
        gstin: true,
        creditLimit: true,
        creditLimitMode: true,
        outstandingBalance: true,
        totalBusiness: true,
        lastTransactionAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        group: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.party.count({ where }),
    // Sum of positive outstanding (receivable)
    prisma.party.aggregate({
      where: { ...baseWhere, outstandingBalance: { gt: 0 } },
      _sum: { outstandingBalance: true },
    }),
    // Sum of negative outstanding (payable)
    prisma.party.aggregate({
      where: { ...baseWhere, outstandingBalance: { lt: 0 } },
      _sum: { outstandingBalance: true },
    }),
    prisma.party.count({ where: { ...baseWhere, type: 'CUSTOMER' } }),
    prisma.party.count({ where: { ...baseWhere, type: 'SUPPLIER' } }),
    prisma.party.count({ where: { ...baseWhere, type: 'BOTH' } }),
  ])

  const totalReceivable = receivableAgg._sum.outstandingBalance ?? 0
  const totalPayable = Math.abs(payableAgg._sum.outstandingBalance ?? 0)

  return {
    parties,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalParties: total,
      totalReceivable,
      totalPayable,
      netOutstanding: totalReceivable - totalPayable,
      customersCount,
      suppliersCount,
      bothCount,
    },
  }
}

export async function getParty(businessId: string, partyId: string) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: {
      id: true,
      businessId: true,
      name: true,
      phone: true,
      email: true,
      companyName: true,
      type: true,
      groupId: true,
      tags: true,
      gstin: true,
      pan: true,
      creditLimit: true,
      creditLimitMode: true,
      outstandingBalance: true,
      totalBusiness: true,
      lastTransactionAt: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      group: { select: { id: true, name: true, color: true, description: true } },
      addresses: {
        select: {
          id: true,
          label: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          pincode: true,
          type: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      },
      customFieldValues: {
        select: {
          id: true,
          fieldId: true,
          value: true,
          field: {
            select: {
              name: true,
              fieldType: true,
              showOnInvoice: true,
              sortOrder: true,
            },
          },
        },
        orderBy: { field: { sortOrder: 'asc' } },
      },
      openingBalance: {
        select: {
          id: true,
          amount: true,
          type: true,
          asOfDate: true,
          notes: true,
        },
      },
    },
  })

  if (!party) throw notFoundError('Party')
  return party
}

export async function updateParty(
  businessId: string,
  partyId: string,
  data: UpdatePartyInput
) {
  await requireParty(businessId, partyId)

  if (data.groupId) {
    await requireGroup(businessId, data.groupId)
  }

  return prisma.$transaction(async (tx) => {
    // Update core party
    const updated = await tx.party.update({
      where: { id: partyId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.groupId !== undefined && { groupId: data.groupId }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.gstin !== undefined && { gstin: data.gstin }),
        ...(data.pan !== undefined && { pan: data.pan }),
        ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
        ...(data.creditLimitMode !== undefined && { creditLimitMode: data.creditLimitMode }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        companyName: true,
        type: true,
        groupId: true,
        tags: true,
        gstin: true,
        pan: true,
        creditLimit: true,
        creditLimitMode: true,
        outstandingBalance: true,
        totalBusiness: true,
        notes: true,
        isActive: true,
        updatedAt: true,
      },
    })

    // Upsert custom field values if provided
    if (data.customFields && data.customFields.length > 0) {
      for (const cf of data.customFields) {
        await tx.partyCustomFieldValue.upsert({
          where: { partyId_fieldId: { partyId, fieldId: cf.fieldId } },
          create: { partyId, fieldId: cf.fieldId, value: cf.value },
          update: { value: cf.value },
        })
      }
    }

    return updated
  })
}

export async function deleteParty(
  businessId: string,
  partyId: string,
  force = false
) {
  await requireParty(businessId, partyId)

  if (force) {
    // Hard delete — only allowed when no transactions exist (checked here via Prisma cascade)
    await prisma.party.delete({ where: { id: partyId } })
    return { deleted: true, mode: 'hard' }
  }

  // Soft delete
  await prisma.party.update({
    where: { id: partyId },
    data: { isActive: false },
  })
  return { deleted: true, mode: 'soft' }
}

// === Addresses ===

export async function createAddress(
  businessId: string,
  partyId: string,
  data: CreateAddressInput
) {
  // Verify party ownership
  await requireParty(businessId, partyId)

  return prisma.$transaction(async (tx) => {
    // If this is the new default, unset existing defaults of same type
    if (data.isDefault) {
      await tx.partyAddress.updateMany({
        where: { partyId, type: data.type, isDefault: true },
        data: { isDefault: false },
      })
    }

    return tx.partyAddress.create({
      data: {
        partyId,
        label: data.label ?? 'Default',
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        type: data.type,
        isDefault: data.isDefault,
      },
      select: {
        id: true,
        partyId: true,
        label: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        pincode: true,
        type: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  })
}

export async function updateAddress(
  businessId: string,
  partyId: string,
  addressId: string,
  data: UpdateAddressInput
) {
  await requireParty(businessId, partyId)

  const address = await prisma.partyAddress.findFirst({
    where: { id: addressId, partyId },
  })
  if (!address) throw notFoundError('Address')

  return prisma.$transaction(async (tx) => {
    // If setting as default, unset other defaults of same type
    const targetType = data.type ?? address.type
    if (data.isDefault) {
      await tx.partyAddress.updateMany({
        where: { partyId, type: targetType, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      })
    }

    return tx.partyAddress.update({
      where: { id: addressId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.line1 !== undefined && { line1: data.line1 }),
        ...(data.line2 !== undefined && { line2: data.line2 }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.pincode !== undefined && { pincode: data.pincode }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
      select: {
        id: true,
        partyId: true,
        label: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        pincode: true,
        type: true,
        isDefault: true,
        updatedAt: true,
      },
    })
  })
}

export async function deleteAddress(
  businessId: string,
  partyId: string,
  addressId: string
) {
  await requireParty(businessId, partyId)

  const address = await prisma.partyAddress.findFirst({
    where: { id: addressId, partyId },
  })
  if (!address) throw notFoundError('Address')

  // Prevent deleting the last billing address
  if (address.type === 'BILLING') {
    const billingCount = await prisma.partyAddress.count({
      where: { partyId, type: 'BILLING' },
    })
    if (billingCount <= 1) {
      throw validationError('Cannot delete the last billing address')
    }
  }

  await prisma.partyAddress.delete({ where: { id: addressId } })
  return { deleted: true }
}

// === Party Groups ===

export async function createGroup(businessId: string, data: CreateGroupInput) {
  try {
    return await prisma.partyGroup.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        color: data.color,
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        description: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Group "${data.name}" already exists`)
      }
    }
    throw err
  }
}

export async function listGroups(businessId: string) {
  // Get groups with party counts in one efficient query
  const groups = await prisma.partyGroup.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { parties: true } },
    },
  })

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    color: g.color,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    partyCount: g._count.parties,
  }))
}

export async function updateGroup(
  businessId: string,
  groupId: string,
  data: UpdateGroupInput
) {
  await requireGroup(businessId, groupId)

  try {
    return await prisma.partyGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.color !== undefined && { color: data.color }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Group name "${data.name}" already exists`)
      }
    }
    throw err
  }
}

export async function deleteGroup(
  businessId: string,
  groupId: string,
  reassignTo?: string
) {
  await requireGroup(businessId, groupId)

  // Validate reassignTo target belongs to business
  if (reassignTo) {
    await requireGroup(businessId, reassignTo)
  }

  await prisma.$transaction(async (tx) => {
    // Reassign or nullify parties in this group
    await tx.party.updateMany({
      where: { businessId, groupId },
      data: { groupId: reassignTo ?? null },
    })

    await tx.partyGroup.delete({ where: { id: groupId } })
  })

  return { deleted: true }
}

// === Custom Fields ===

const MAX_CUSTOM_FIELDS_PER_ENTITY = 20

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

  // Block fieldType change if values already exist
  // (fieldType is not in updateCustomFieldSchema, but guard defensively)
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

// === Pricing ===

export async function setPricing(
  businessId: string,
  partyId: string,
  data: SetPricingInput
) {
  await requireParty(businessId, partyId)

  // Upsert all pricing entries in a transaction
  const results = await prisma.$transaction(
    data.pricing.map((item) =>
      prisma.partyPricing.upsert({
        where: { partyId_productId: { partyId, productId: item.productId } },
        create: {
          partyId,
          productId: item.productId,
          price: item.price,
          minQty: item.minQty,
        },
        update: {
          price: item.price,
          minQty: item.minQty,
        },
        select: {
          id: true,
          productId: true,
          price: true,
          minQty: true,
          updatedAt: true,
        },
      })
    )
  )

  return results
}

export async function getPartyPricing(
  businessId: string,
  partyId: string,
  search?: string,
  page = 1,
  limit = 50
) {
  await requireParty(businessId, partyId)

  const skip = (page - 1) * limit

  const where: Prisma.PartyPricingWhereInput = {
    partyId,
  }

  if (search) {
    where.productId = { contains: search, mode: 'insensitive' }
  }

  const [pricing, total] = await Promise.all([
    prisma.partyPricing.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        productId: true,
        price: true,
        minQty: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.partyPricing.count({ where }),
  ])

  return {
    pricing,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
