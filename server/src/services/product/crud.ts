/**
 * Product CRUD — create, get, update, delete, barcode lookup.
 * Amounts in PAISE (integer). All queries scoped to businessId.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, conflictError } from '../../lib/errors.js'
import { adjustStock, scheduleAlertChecks } from '../stock.service.js'
import logger from '../../lib/logger.js'
import type { CreateProductInput, UpdateProductInput } from '../../schemas/product.schemas.js'
import { requireProduct, generateSku } from './helpers.js'
import { productDetailSelect, stockMovementSelect } from './selects.js'

export async function createProduct(
  businessId: string,
  userId: string,
  data: CreateProductInput
) {
  logger.info('Creating product', { businessId, productName: data.name })

  // Validate categoryId if provided
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: data.categoryId, businessId },
    })
    if (!cat) throw notFoundError('Category')
  }

  // Validate unitId
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId, businessId },
  })
  if (!unit) throw notFoundError('Unit')

  // Generate or validate SKU
  let sku: string | null = null
  if (data.autoGenerateSku) {
    sku = await generateSku(businessId)
  } else if (data.sku) {
    const existing = await prisma.product.findFirst({
      where: { businessId, sku: data.sku },
    })
    if (existing) throw conflictError(`SKU "${data.sku}" already exists`)
    sku = data.sku
  }

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId,
        name: data.name,
        sku,
        categoryId: data.categoryId ?? null,
        unitId: data.unitId,
        salePrice: data.salePrice,
        purchasePrice: data.purchasePrice ?? null,
        currentStock: 0,
        minStockLevel: data.minStockLevel,
        stockValidation: data.stockValidation,
        hsnCode: data.hsnCode ?? null,
        sacCode: data.sacCode ?? null,
        taxCategoryId: data.taxCategoryId ?? null,
        description: data.description ?? null,
        barcode: data.barcode ?? null,
        barcodeFormat: data.barcodeFormat ?? null,
        status: data.status,
      },
      select: productDetailSelect,
    })

    if (data.customFields.length > 0) {
      await tx.productCustomFieldValue.createMany({
        data: data.customFields.map((cf) => ({
          productId: product.id,
          fieldId: cf.fieldId,
          value: cf.value,
        })),
      })
    }

    if (data.openingStock > 0) {
      await adjustStock(tx, {
        productId: product.id,
        businessId,
        quantity: data.openingStock,
        type: 'OPENING',
        userId,
      })
    }

    return tx.product.findUniqueOrThrow({
      where: { id: product.id },
      select: productDetailSelect,
    })
  })

  scheduleAlertChecks(businessId, [result.id])
  return result
}

export async function getProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: {
      ...productDetailSelect,
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
    },
  })

  if (!product) throw notFoundError('Product')

  const recentMovements = await prisma.stockMovement.findMany({
    where: { productId, businessId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: stockMovementSelect,
  })

  return { ...product, recentMovements }
}

export async function updateProduct(
  businessId: string,
  productId: string,
  data: UpdateProductInput
) {
  await requireProduct(businessId, productId)

  if (data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: data.categoryId, businessId },
    })
    if (!cat) throw notFoundError('Category')
  }

  if (data.unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, businessId },
    })
    if (!unit) throw notFoundError('Unit')
  }

  if (data.sku) {
    const existing = await prisma.product.findFirst({
      where: { businessId, sku: data.sku, id: { not: productId } },
    })
    if (existing) throw conflictError(`SKU "${data.sku}" already exists`)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.unitId !== undefined && { unitId: data.unitId }),
        ...(data.salePrice !== undefined && { salePrice: data.salePrice }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
        ...(data.minStockLevel !== undefined && { minStockLevel: data.minStockLevel }),
        ...(data.stockValidation !== undefined && { stockValidation: data.stockValidation }),
        ...(data.hsnCode !== undefined && { hsnCode: data.hsnCode }),
        ...(data.sacCode !== undefined && { sacCode: data.sacCode }),
        ...(data.taxCategoryId !== undefined && { taxCategoryId: data.taxCategoryId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.barcode !== undefined && { barcode: data.barcode }),
        ...(data.barcodeFormat !== undefined && { barcodeFormat: data.barcodeFormat }),
        ...(data.moq !== undefined && { moq: data.moq }),
        ...(data.labelTemplate !== undefined && { labelTemplate: data.labelTemplate }),
        ...(data.status !== undefined && { status: data.status }),
      },
      select: productDetailSelect,
    })

    if (data.customFields && data.customFields.length > 0) {
      await Promise.all(data.customFields.map(cf =>
        tx.productCustomFieldValue.upsert({
          where: { productId_fieldId: { productId, fieldId: cf.fieldId } },
          create: { productId, fieldId: cf.fieldId, value: cf.value },
          update: { value: cf.value },
        })
      ))
    }

    return updated
  })
}

export async function deleteProduct(businessId: string, productId: string) {
  await requireProduct(businessId, productId)

  await prisma.product.update({
    where: { id: productId },
    data: { status: 'INACTIVE' },
  })

  return { deleted: true, mode: 'soft' }
}

/** Find a product by its barcode value, scoped to the business. */
export async function findByBarcode(businessId: string, barcode: string) {
  const product = await prisma.product.findFirst({
    where: { businessId, barcode },
    select: {
      ...productDetailSelect,
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
    },
  })
  if (!product) throw notFoundError('Product')
  return product
}
