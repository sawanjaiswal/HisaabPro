/**
 * Product Placeholders — idempotent service-placeholder product per business.
 * Used by convert-to-invoice when a JobItem has no productId.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

const SERVICE_SKU = '__SERVICE__'

/**
 * Look up or create a generic "Service" placeholder Product for a business.
 * Idempotent: safe to call on every convert operation.
 */
export async function ensureServicePlaceholder(businessId: string): Promise<string> {
  // Fast path: already exists
  const existing = await prisma.product.findFirst({
    where: { businessId, sku: SERVICE_SKU },
    select: { id: true },
  })
  if (existing) return existing.id

  // Resolve a unit: InventorySetting.defaultUnitId → first unit → create 'pcs'
  let unitId: string

  const inventorySetting = await prisma.inventorySetting.findUnique({
    where: { businessId },
    select: { defaultUnitId: true },
  })

  if (inventorySetting?.defaultUnitId) {
    unitId = inventorySetting.defaultUnitId
  } else {
    const firstUnit = await prisma.unit.findFirst({
      where: { businessId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    if (firstUnit) {
      unitId = firstUnit.id
    } else {
      // Create a basic 'pcs' unit
      const newUnit = await prisma.unit.create({
        data: { businessId, name: 'Pieces', symbol: 'pcs' },
        select: { id: true },
      })
      unitId = newUnit.id
    }
  }

  try {
    const product = await prisma.product.create({
      data: {
        businessId,
        name: 'Service',
        sku: SERVICE_SKU,
        unitId,
        salePrice: 0,
        stockValidation: 'NONE',
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    logger.info('Created service placeholder product', { businessId, productId: product.id })
    return product.id
  } catch (err: unknown) {
    // P2002: concurrent creation — fetch the one that won
    if (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code: string }).code === 'P2002'
    ) {
      const race = await prisma.product.findFirst({
        where: { businessId, sku: SERVICE_SKU },
        select: { id: true },
      })
      if (race) return race.id
    }
    throw err
  }
}
