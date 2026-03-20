/**
 * Tax Category Service — business logic for CRUD + seeding
 */

import { prisma } from '../lib/prisma.js'
import type { Prisma } from '@prisma/client'

const DEFAULT_CATEGORIES = [
  { name: 'Exempt',  rate: 0,    cessRate: 0, cessType: 'PERCENTAGE', isDefault: true },
  { name: 'GST 0%',  rate: 0,    cessRate: 0, cessType: 'PERCENTAGE', isDefault: true },
  { name: 'GST 5%',  rate: 500,  cessRate: 0, cessType: 'PERCENTAGE', isDefault: true },
  { name: 'GST 12%', rate: 1200, cessRate: 0, cessType: 'PERCENTAGE', isDefault: true },
  { name: 'GST 18%', rate: 1800, cessRate: 0, cessType: 'PERCENTAGE', isDefault: true },
  { name: 'GST 28%', rate: 2800, cessRate: 0, cessType: 'PERCENTAGE', isDefault: true },
] as const

const LIST_SELECT = {
  id: true, name: true, rate: true, cessRate: true, cessType: true,
  hsnCode: true, sacCode: true, isDefault: true, isActive: true, updatedAt: true,
} as const

export async function listCategories(businessId: string, showInactive: boolean) {
  return prisma.taxCategory.findMany({
    where: { businessId, ...(showInactive ? {} : { isActive: true }) },
    orderBy: [{ isDefault: 'desc' }, { rate: 'asc' }, { name: 'asc' }],
    take: 200,
    select: LIST_SELECT,
  })
}

export async function getCategory(id: string, businessId: string) {
  return prisma.taxCategory.findFirst({ where: { id, businessId } })
}

export async function createCategory(businessId: string, data: Prisma.TaxCategoryCreateInput) {
  return prisma.taxCategory.create({ data: { ...data, business: { connect: { id: businessId } } } })
}

export async function updateCategory(id: string, businessId: string, data: Prisma.TaxCategoryUpdateInput) {
  const result = await prisma.taxCategory.updateMany({ where: { id, businessId }, data })
  if (result.count === 0) return null
  return prisma.taxCategory.findFirst({ where: { id, businessId } })
}

export async function softDeleteCategory(id: string, businessId: string) {
  const result = await prisma.taxCategory.updateMany({
    where: { id, businessId },
    data: { isActive: false },
  })
  return result.count > 0
}

export async function seedDefaults(businessId: string) {
  const existing = await prisma.taxCategory.count({ where: { businessId } })
  if (existing > 0) return { seeded: false, count: 0 }

  const created = await prisma.taxCategory.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, businessId })),
    skipDuplicates: true,
  })
  return { seeded: true, count: created.count }
}
