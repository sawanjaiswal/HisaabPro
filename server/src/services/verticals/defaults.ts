/**
 * Vertical defaults — InventorySetting overrides per business type.
 *
 * Pure mapping (no DB). Consumed by:
 *   - createBusiness() — seed InventorySetting after the business row is created
 *   - applyVerticalDefaults() — re-apply when a user switches vertical from
 *     Settings (with the "Also apply default settings" checkbox).
 *
 * Schema defaults (see prisma/schema.prisma → InventorySetting):
 *   stockValidationMode    'WARN_ONLY'
 *   skuPrefix              'PRD'
 *   skuAutoGenerate        true
 *   lowStockAlertEnabled   true
 *   lowStockAlertFrequency 'DAILY'
 *   decimalPrecisionQty    2
 *
 * Verticals not listed below fall back to those schema defaults.
 */

import { prisma } from '../../lib/prisma.js'

export type StockValidationMode = 'WARN_ONLY' | 'HARD_BLOCK'
export type LowStockFrequency = 'ONCE' | 'DAILY' | 'EVERY_TIME'

export interface InventoryDefaults {
  stockValidationMode?: StockValidationMode
  skuPrefix?: string
  skuAutoGenerate?: boolean
  lowStockAlertEnabled?: boolean
  lowStockAlertFrequency?: LowStockFrequency
  decimalPrecisionQty?: number
}

export interface VerticalDefaults {
  inventory: InventoryDefaults
  /** Human-readable summary lines for the UI confirmation modal. */
  summary: string[]
}

const PURE_SERVICE: VerticalDefaults = {
  inventory: {
    stockValidationMode: 'WARN_ONLY',
    lowStockAlertEnabled: false,
    decimalPrecisionQty: 0,
  },
  summary: [
    'Turn off low-stock alerts',
    'Set quantity precision to whole numbers',
  ],
}

export const VERTICAL_DEFAULTS: Record<string, VerticalDefaults> = {
  services:   PURE_SERVICE,
  freelancer: PURE_SERVICE,
  salon:      PURE_SERVICE,
  clinic:     PURE_SERVICE,

  restaurant: {
    inventory: {
      stockValidationMode: 'WARN_ONLY',
      skuPrefix: 'MENU',
      lowStockAlertEnabled: false,
      decimalPrecisionQty: 2,
    },
    summary: [
      'Use “MENU” as the SKU prefix',
      'Turn off low-stock alerts (track raw materials separately)',
    ],
  },

  pharmacy: {
    inventory: {
      stockValidationMode: 'HARD_BLOCK',
      skuPrefix: 'MED',
      lowStockAlertEnabled: true,
      lowStockAlertFrequency: 'EVERY_TIME',
      decimalPrecisionQty: 0,
    },
    summary: [
      'Block sales beyond available stock',
      'Use “MED” as the SKU prefix',
      'Alert on every low-stock item',
    ],
  },

  bakery: {
    inventory: {
      skuPrefix: 'CAKE',
      lowStockAlertEnabled: true,
      lowStockAlertFrequency: 'DAILY',
      decimalPrecisionQty: 1,
    },
    summary: [
      'Use “CAKE” as the SKU prefix',
      'Daily low-stock alerts',
      'One decimal for quantities (e.g. 1.5 kg)',
    ],
  },

  tailor: {
    inventory: {
      skuPrefix: 'TLR',
      lowStockAlertEnabled: false,
      decimalPrecisionQty: 2,
    },
    summary: [
      'Use “TLR” as the SKU prefix',
      'Turn off low-stock alerts',
    ],
  },
}

export function getDefaultsFor(type: string): VerticalDefaults | null {
  return VERTICAL_DEFAULTS[type] ?? null
}

/** Upsert InventorySetting with the vertical's defaults. Safe to call repeatedly. */
export async function applyVerticalDefaults(businessId: string, type: string) {
  const defaults = getDefaultsFor(type)
  if (!defaults) {
    // No overrides — make sure InventorySetting exists with schema defaults.
    await prisma.inventorySetting.upsert({
      where: { businessId },
      create: { businessId },
      update: {},
    })
    return { applied: false, summary: [] as string[] }
  }

  await prisma.inventorySetting.upsert({
    where: { businessId },
    create: { businessId, ...defaults.inventory },
    update: defaults.inventory,
  })

  return { applied: true, summary: defaults.summary }
}
