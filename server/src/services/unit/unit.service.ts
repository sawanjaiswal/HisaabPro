/**
 * Unit CRUD — list, create, update, delete
 */

import { prisma } from '../../lib/prisma.js'
import { validationError, conflictError } from '../../lib/errors.js'
import type { CreateUnitInput, UpdateUnitInput } from '../../schemas/product.schemas.js'
import { ensurePredefinedUnits, requireUnit } from './constants.js'

export async function listUnits(businessId: string) {
  await ensurePredefinedUnits(businessId)

  const units = await prisma.unit.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    take: 200,
    select: {
      id: true,
      name: true,
      symbol: true,
      type: true,
      category: true,
      decimalAllowed: true,
      baseUnitId: true,
      baseUnitFactor: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } },
      baseUnit: { select: { id: true, name: true, symbol: true } },
    },
  })

  return units.map((u) => ({
    id: u.id,
    name: u.name,
    symbol: u.symbol,
    type: u.type,
    category: u.category,
    decimalAllowed: u.decimalAllowed,
    baseUnitId: u.baseUnitId,
    baseUnitFactor: u.baseUnitFactor,
    baseUnit: u.baseUnit,
    productCount: u._count.products,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }))
}

export async function createUnit(businessId: string, data: CreateUnitInput) {
  await ensurePredefinedUnits(businessId)

  try {
    return await prisma.unit.create({
      data: {
        businessId,
        name: data.name,
        symbol: data.symbol,
        type: 'CUSTOM',
        category: data.category ?? 'OTHER',
        decimalAllowed: data.decimalAllowed ?? true,
        baseUnitId: data.baseUnitId ?? null,
        baseUnitFactor: data.baseUnitFactor ?? null,
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        type: true,
        category: true,
        decimalAllowed: true,
        baseUnitId: true,
        baseUnitFactor: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Unit "${data.name}" or symbol "${data.symbol}" already exists`)
      }
    }
    throw err
  }
}

export async function updateUnit(
  businessId: string,
  unitId: string,
  data: UpdateUnitInput
) {
  const unit = await requireUnit(businessId, unitId)

  if (unit.type === 'PREDEFINED') {
    throw validationError('Cannot modify predefined units')
  }

  try {
    return await prisma.unit.update({
      where: { id: unitId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.symbol !== undefined && { symbol: data.symbol }),
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        type: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Unit name or symbol already exists`)
      }
    }
    throw err
  }
}

export async function deleteUnit(businessId: string, unitId: string) {
  const unit = await requireUnit(businessId, unitId)

  if (unit.type === 'PREDEFINED') {
    throw validationError('Cannot delete predefined units')
  }

  const productCount = await prisma.product.count({
    where: { businessId, unitId },
  })
  if (productCount > 0) {
    throw validationError(
      `Cannot delete unit: ${productCount} product(s) still use it. Reassign products first.`
    )
  }

  await prisma.unitConversion.deleteMany({
    where: {
      businessId,
      OR: [{ fromUnitId: unitId }, { toUnitId: unitId }],
    },
  })

  await prisma.unit.update({
    where: { id: unitId },
    data: { isDeleted: true, deletedAt: new Date() },
  })
  return { deleted: true }
}
