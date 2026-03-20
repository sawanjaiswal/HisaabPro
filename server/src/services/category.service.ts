/**
 * Category Service
 * CRUD for product categories. Predefined categories seeded per business on first access.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../lib/errors.js'
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_COLOR } from '../config/defaults.js'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/product.schemas.js'

/** Seed predefined categories for a business if none exist */
async function ensurePredefinedCategories(businessId: string) {
  const count = await prisma.category.count({ where: { businessId } })
  if (count > 0) return

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({
      businessId,
      name: cat.name,
      type: 'PREDEFINED',
      color: cat.color,
      sortOrder: cat.sortOrder,
    })),
  })
}

/** Verify category belongs to business */
async function requireCategory(businessId: string, categoryId: string) {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, businessId },
  })
  if (!cat) throw notFoundError('Category')
  return cat
}

export async function listCategories(businessId: string) {
  await ensurePredefinedCategories(businessId)

  const categories = await prisma.category.findMany({
    where: { businessId },
    orderBy: { sortOrder: 'asc' },
    take: 200,
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      sortOrder: true,
      isHidden: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } },
    },
  })

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
    sortOrder: c.sortOrder,
    isHidden: c.isHidden,
    productCount: c._count.products,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }))
}

export async function createCategory(businessId: string, data: CreateCategoryInput) {
  await ensurePredefinedCategories(businessId)

  // Get max sortOrder for proper ordering
  const maxSort = await prisma.category.aggregate({
    where: { businessId },
    _max: { sortOrder: true },
  })

  try {
    return await prisma.category.create({
      data: {
        businessId,
        name: data.name,
        type: 'CUSTOM',
        color: data.color ?? DEFAULT_CATEGORY_COLOR,
        sortOrder: data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        sortOrder: true,
        isHidden: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Category "${data.name}" already exists`)
      }
    }
    throw err
  }
}

export async function updateCategory(
  businessId: string,
  categoryId: string,
  data: UpdateCategoryInput
) {
  const cat = await requireCategory(businessId, categoryId)

  // Predefined categories: only allow isHidden, color, sortOrder changes
  if (cat.type === 'PREDEFINED' && data.name) {
    throw validationError('Cannot rename predefined categories')
  }

  try {
    return await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isHidden !== undefined && { isHidden: data.isHidden }),
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        sortOrder: true,
        isHidden: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const prismaErr = err as { code: string }
      if (prismaErr.code === 'P2002') {
        throw conflictError(`Category name "${data.name}" already exists`)
      }
    }
    throw err
  }
}

export async function deleteCategory(
  businessId: string,
  categoryId: string,
  reassignTo: string
) {
  const cat = await requireCategory(businessId, categoryId)

  if (cat.type === 'PREDEFINED') {
    throw validationError('Cannot delete predefined categories. Use "hide" instead.')
  }

  // Validate reassign target
  const target = await requireCategory(businessId, reassignTo)
  if (target.id === categoryId) {
    throw validationError('Cannot reassign products to the same category being deleted')
  }

  await prisma.$transaction(async (tx) => {
    // Reassign products
    await tx.product.updateMany({
      where: { businessId, categoryId },
      data: { categoryId: reassignTo },
    })

    await tx.category.delete({ where: { id: categoryId } })
  })

  return { deleted: true }
}
