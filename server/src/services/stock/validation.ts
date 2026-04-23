/**
 * Stock Validation — Pre-flight stock availability check for invoices.
 * Uses batch queries (no N+1). Returns per-item OK/WARN/BLOCK results.
 */

import { prisma } from '../../lib/prisma.js'
import type { InvoiceStockItem } from './invoice-ops.js'

export async function validateStockForInvoice(
  businessId: string,
  items: InvoiceStockItem[]
) {
  // --- Batch query 1: all products in one round-trip ---
  const productIds = items.map((i) => i.productId)
  const productRows = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: {
      id: true,
      name: true,
      currentStock: true,
      stockValidation: true,
      unitId: true,
      unit: { select: { name: true, symbol: true } },
    },
  })
  const productMap = new Map(productRows.map((p) => [p.id, p]))

  // --- Batch query 2: business validation mode once ---
  const setting = await prisma.inventorySetting.findUnique({
    where: { businessId },
    select: { stockValidationMode: true },
  })
  const businessMode = (setting?.stockValidationMode as 'WARN_ONLY' | 'HARD_BLOCK') ?? 'WARN_ONLY'

  // --- Batch query 3: all unit conversions in one round-trip ---
  // Collect unique (fromUnitId, toUnitId) pairs where unit differs from product.
  // When unitId is omitted from the request, treat the quantity as already
  // expressed in the product's base unit (no conversion needed).
  const conversionPairs: Array<{ fromUnitId: string; toUnitId: string }> = []
  for (const item of items) {
    const product = productMap.get(item.productId)
    if (product && item.unitId && item.unitId !== product.unitId) {
      conversionPairs.push({ fromUnitId: item.unitId, toUnitId: product.unitId })
    }
  }

  const conversionMap = new Map<string, number>()
  if (conversionPairs.length > 0) {
    const conversions = await prisma.unitConversion.findMany({
      where: {
        businessId,
        OR: conversionPairs,
      },
      select: { fromUnitId: true, toUnitId: true, factor: true },
    })
    for (const c of conversions) {
      conversionMap.set(`${c.fromUnitId}:${c.toUnitId}`, Number(c.factor))
    }
  }

  // --- Loop using Maps (O(1) lookups, zero additional queries) ---
  const results = []
  let allValid = true

  for (const item of items) {
    const product = productMap.get(item.productId)

    if (!product) {
      results.push({
        productId: item.productId,
        productName: 'Unknown',
        requestedQty: item.quantity,
        requestedUnit: '',
        currentStock: 0,
        deficit: item.quantity,
        validation: 'BLOCK' as const,
        message: 'Product not found',
      })
      allValid = false
      continue
    }

    // Convert quantity if unit differs from product's base unit.
    // Missing unitId → assume base unit (no conversion).
    let baseQty = item.quantity
    if (item.unitId && item.unitId !== product.unitId) {
      const factor = conversionMap.get(`${item.unitId}:${product.unitId}`)
      if (factor !== undefined) {
        baseQty = item.quantity * factor
      }
    }

    const currentStock = Number(product.currentStock)
    const deficit = baseQty - currentStock

    if (deficit <= 0) {
      results.push({
        productId: product.id,
        productName: product.name,
        requestedQty: baseQty,
        requestedUnit: product.unit.symbol,
        currentStock,
        deficit: 0,
        validation: 'OK' as const,
        message: null,
      })
      continue
    }

    // Resolve effective validation mode using cached business mode
    const effectiveMode =
      product.stockValidation === 'GLOBAL' ? businessMode : product.stockValidation

    const validation = effectiveMode === 'HARD_BLOCK' ? 'BLOCK' : 'WARN'
    if (validation === 'BLOCK') allValid = false

    results.push({
      productId: product.id,
      productName: product.name,
      requestedQty: baseQty,
      requestedUnit: product.unit.symbol,
      currentStock,
      deficit,
      validation,
      message: `Only ${currentStock} ${product.unit.symbol} available, ${baseQty} requested`,
    })
  }

  return { valid: allValid, items: results }
}
