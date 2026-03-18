/**
 * Unit & Unit Conversion Service
 * CRUD for measurement units and conversion factors. Predefined units seeded per business.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../lib/errors.js'
import type {
  CreateUnitInput,
  UpdateUnitInput,
  CreateConversionInput,
  UpdateConversionInput,
} from '../schemas/product.schemas.js'

// 19 predefined units per PRD
const PREDEFINED_UNITS: { name: string; symbol: string; category: string; decimalAllowed: boolean }[] = [
  { name: 'pieces',      symbol: 'pcs',  category: 'COUNT',     decimalAllowed: false },
  { name: 'kilogram',    symbol: 'kg',   category: 'WEIGHT',    decimalAllowed: true },
  { name: 'gram',        symbol: 'gm',   category: 'WEIGHT',    decimalAllowed: true },
  { name: 'litre',       symbol: 'ltr',  category: 'VOLUME',    decimalAllowed: true },
  { name: 'millilitre',  symbol: 'ml',   category: 'VOLUME',    decimalAllowed: true },
  { name: 'box',         symbol: 'box',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'dozen',       symbol: 'dz',   category: 'COUNT',     decimalAllowed: false },
  { name: 'meter',       symbol: 'm',    category: 'LENGTH',    decimalAllowed: true },
  { name: 'centimeter',  symbol: 'cm',   category: 'LENGTH',    decimalAllowed: true },
  { name: 'feet',        symbol: 'ft',   category: 'LENGTH',    decimalAllowed: true },
  { name: 'inch',        symbol: 'in',   category: 'LENGTH',    decimalAllowed: true },
  { name: 'pair',        symbol: 'pr',   category: 'COUNT',     decimalAllowed: false },
  { name: 'set',         symbol: 'set',  category: 'COUNT',     decimalAllowed: false },
  { name: 'bundle',      symbol: 'bdl',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'roll',        symbol: 'roll', category: 'PACKAGING', decimalAllowed: false },
  { name: 'bag',         symbol: 'bag',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'packet',      symbol: 'pkt',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'bottle',      symbol: 'btl',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'can',         symbol: 'can',  category: 'PACKAGING', decimalAllowed: false },
]

/** Seed predefined units for a business if none exist */
async function ensurePredefinedUnits(businessId: string) {
  const count = await prisma.unit.count({ where: { businessId } })
  if (count > 0) return

  await prisma.unit.createMany({
    data: PREDEFINED_UNITS.map((u) => ({
      businessId,
      name: u.name,
      symbol: u.symbol,
      type: 'PREDEFINED',
      category: u.category,
      decimalAllowed: u.decimalAllowed,
    })),
  })
}

/** Verify unit belongs to business */
async function requireUnit(businessId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, businessId },
  })
  if (!unit) throw notFoundError('Unit')
  return unit
}

// === Units ===

export async function listUnits(businessId: string) {
  await ensurePredefinedUnits(businessId)

  const units = await prisma.unit.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
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

  // Check if any products use this unit
  const productCount = await prisma.product.count({
    where: { businessId, unitId },
  })
  if (productCount > 0) {
    throw validationError(
      `Cannot delete unit: ${productCount} product(s) still use it. Reassign products first.`
    )
  }

  // Delete conversions involving this unit first
  await prisma.unitConversion.deleteMany({
    where: {
      businessId,
      OR: [{ fromUnitId: unitId }, { toUnitId: unitId }],
    },
  })

  await prisma.unit.delete({ where: { id: unitId } })
  return { deleted: true }
}

// === Unit Conversions ===

export async function listConversions(businessId: string) {
  return prisma.unitConversion.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fromUnitId: true,
      fromUnit: { select: { name: true, symbol: true } },
      toUnitId: true,
      toUnit: { select: { name: true, symbol: true } },
      factor: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function createConversion(businessId: string, data: CreateConversionInput) {
  // Validate units exist and belong to business
  await requireUnit(businessId, data.fromUnitId)
  await requireUnit(businessId, data.toUnitId)

  if (data.fromUnitId === data.toUnitId) {
    throw validationError('Cannot create conversion between the same unit')
  }

  // Check if conversion already exists
  const existing = await prisma.unitConversion.findFirst({
    where: {
      businessId,
      fromUnitId: data.fromUnitId,
      toUnitId: data.toUnitId,
    },
  })
  if (existing) {
    throw conflictError('Conversion between these units already exists')
  }

  // Create both forward and reverse conversions in a transaction
  const [forward] = await prisma.$transaction([
    prisma.unitConversion.create({
      data: {
        businessId,
        fromUnitId: data.fromUnitId,
        toUnitId: data.toUnitId,
        factor: data.factor,
      },
      select: {
        id: true,
        fromUnitId: true,
        fromUnit: { select: { name: true, symbol: true } },
        toUnitId: true,
        toUnit: { select: { name: true, symbol: true } },
        factor: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.unitConversion.create({
      data: {
        businessId,
        fromUnitId: data.toUnitId,
        toUnitId: data.fromUnitId,
        factor: 1 / data.factor,
      },
    }),
  ])

  return forward
}

export async function updateConversion(
  businessId: string,
  conversionId: string,
  data: UpdateConversionInput
) {
  const conv = await prisma.unitConversion.findFirst({
    where: { id: conversionId, businessId },
  })
  if (!conv) throw notFoundError('Unit conversion')

  // Update forward and reverse
  const [updated] = await prisma.$transaction([
    prisma.unitConversion.update({
      where: { id: conversionId },
      data: { factor: data.factor },
      select: {
        id: true,
        fromUnitId: true,
        fromUnit: { select: { name: true, symbol: true } },
        toUnitId: true,
        toUnit: { select: { name: true, symbol: true } },
        factor: true,
        updatedAt: true,
      },
    }),
    prisma.unitConversion.updateMany({
      where: {
        businessId,
        fromUnitId: conv.toUnitId,
        toUnitId: conv.fromUnitId,
      },
      data: { factor: 1 / data.factor },
    }),
  ])

  return updated
}

export async function deleteConversion(businessId: string, conversionId: string) {
  const conv = await prisma.unitConversion.findFirst({
    where: { id: conversionId, businessId },
  })
  if (!conv) throw notFoundError('Unit conversion')

  // Delete both forward and reverse
  await prisma.$transaction([
    prisma.unitConversion.delete({ where: { id: conversionId } }),
    prisma.unitConversion.deleteMany({
      where: {
        businessId,
        fromUnitId: conv.toUnitId,
        toUnitId: conv.fromUnitId,
      },
    }),
  ])

  return { deleted: true }
}
