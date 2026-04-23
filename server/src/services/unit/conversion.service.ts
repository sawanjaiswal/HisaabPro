/**
 * Unit Conversion CRUD — list, create, update, delete
 * Automatically maintains bidirectional (forward + reverse) conversion records.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../../lib/errors.js'
import type { CreateConversionInput, UpdateConversionInput } from '../../schemas/product.schemas.js'
import { requireUnit } from './constants.js'

export async function listConversions(businessId: string) {
  return prisma.unitConversion.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: 200,
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
  await requireUnit(businessId, data.fromUnitId)
  await requireUnit(businessId, data.toUnitId)

  if (data.fromUnitId === data.toUnitId) {
    throw validationError('Cannot create conversion between the same unit')
  }

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
