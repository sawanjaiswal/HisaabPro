/**
 * Inventory Settings Service
 * Business-level inventory configuration (stock validation mode, SKU settings, alerts).
 */

import { prisma } from '../lib/prisma.js'
import type { UpdateInventorySettingsInput } from '../schemas/product.schemas.js'

/** Get or create default inventory settings for a business */
export async function getSettings(businessId: string) {
  const settings = await prisma.inventorySetting.upsert({
    where: { businessId },
    create: { businessId },
    update: {},
    select: {
      stockValidationMode: true,
      skuPrefix: true,
      skuAutoGenerate: true,
      lowStockAlertFrequency: true,
      lowStockAlertEnabled: true,
      decimalPrecisionQty: true,
      defaultCategoryId: true,
      defaultUnitId: true,
    },
  })

  return settings
}

export async function updateSettings(
  businessId: string,
  data: UpdateInventorySettingsInput
) {
  const settings = await prisma.inventorySetting.upsert({
    where: { businessId },
    create: {
      businessId,
      ...(data.stockValidationMode !== undefined && { stockValidationMode: data.stockValidationMode }),
      ...(data.skuPrefix !== undefined && { skuPrefix: data.skuPrefix }),
      ...(data.skuAutoGenerate !== undefined && { skuAutoGenerate: data.skuAutoGenerate }),
      ...(data.lowStockAlertFrequency !== undefined && { lowStockAlertFrequency: data.lowStockAlertFrequency }),
      ...(data.lowStockAlertEnabled !== undefined && { lowStockAlertEnabled: data.lowStockAlertEnabled }),
      ...(data.decimalPrecisionQty !== undefined && { decimalPrecisionQty: data.decimalPrecisionQty }),
      ...(data.defaultCategoryId !== undefined && { defaultCategoryId: data.defaultCategoryId }),
      ...(data.defaultUnitId !== undefined && { defaultUnitId: data.defaultUnitId }),
    },
    update: {
      ...(data.stockValidationMode !== undefined && { stockValidationMode: data.stockValidationMode }),
      ...(data.skuPrefix !== undefined && { skuPrefix: data.skuPrefix }),
      ...(data.skuAutoGenerate !== undefined && { skuAutoGenerate: data.skuAutoGenerate }),
      ...(data.lowStockAlertFrequency !== undefined && { lowStockAlertFrequency: data.lowStockAlertFrequency }),
      ...(data.lowStockAlertEnabled !== undefined && { lowStockAlertEnabled: data.lowStockAlertEnabled }),
      ...(data.decimalPrecisionQty !== undefined && { decimalPrecisionQty: data.decimalPrecisionQty }),
      ...(data.defaultCategoryId !== undefined && { defaultCategoryId: data.defaultCategoryId }),
      ...(data.defaultUnitId !== undefined && { defaultUnitId: data.defaultUnitId }),
    },
    select: {
      stockValidationMode: true,
      skuPrefix: true,
      skuAutoGenerate: true,
      lowStockAlertFrequency: true,
      lowStockAlertEnabled: true,
      decimalPrecisionQty: true,
      defaultCategoryId: true,
      defaultUnitId: true,
    },
  })

  return settings
}
