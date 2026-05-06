/**
 * Stock Alert Service — Feature #47
 *
 * Creates, manages, and resolves low-stock and out-of-stock alerts.
 * Called after stock movements to detect threshold breaches.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

interface ListAlertsOpts {
  status?: string
  cursor?: string
  limit?: number
}

/**
 * Check stock level against threshold and create/resolve alerts.
 * Call after any stock movement. Wrapped in try/catch by caller — never blocks stock ops.
 */
export async function checkAndCreateAlerts(
  businessId: string,
  productId: string
): Promise<void> {
  // Fetch product stock + business alert settings in parallel
  const [product, setting] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, currentStock: true, minStockLevel: true, reorderQty: true },
    }),
    prisma.inventorySetting.findUnique({
      where: { businessId },
      select: { lowStockAlertEnabled: true },
    }),
  ])

  if (!product) return
  if (setting && !setting.lowStockAlertEnabled) return

  const currentStock = Number(product.currentStock)
  const minLevel = Number(product.minStockLevel)
  const reorderQty = product.reorderQty !== null ? Number(product.reorderQty) : null

  // Check both threshold conditions (either triggers an alert)
  const minLevelBreached = minLevel > 0 && currentStock <= minLevel
  const reorderBreached = reorderQty !== null && currentStock <= reorderQty
  const isBreached = minLevelBreached || reorderBreached

  // Use the higher of the two thresholds as the representative threshold
  const threshold = reorderQty !== null
    ? Math.max(minLevel, reorderQty)
    : minLevel

  // Stock is above both thresholds — resolve any active alerts
  if (!isBreached) {
    await resolveAlerts(businessId, productId)
    return
  }

  // Determine alert type
  const alertType = currentStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'

  // Check for existing active alert of the same type (prevent duplicates)
  const existing = await prisma.stockAlert.findFirst({
    where: {
      businessId,
      productId,
      alertType,
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  if (existing) {
    // Update current quantity on existing alert
    await prisma.stockAlert.update({
      where: { id: existing.id },
      data: { currentQty: currentStock },
    })
    return
  }

  // If upgrading from LOW_STOCK to OUT_OF_STOCK, resolve the low-stock alert
  if (alertType === 'OUT_OF_STOCK') {
    await prisma.stockAlert.updateMany({
      where: {
        businessId,
        productId,
        alertType: 'LOW_STOCK',
        status: 'ACTIVE',
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    })
  }

  // Create new alert
  await prisma.stockAlert.create({
    data: {
      businessId,
      productId,
      alertType,
      threshold,
      currentQty: currentStock,
    },
  })

  logger.info('Stock alert created', {
    businessId,
    productId,
    productName: product.name,
    alertType,
    currentStock,
    threshold,
    minStockLevel: minLevel,
    reorderQty,
  })
}

/**
 * Evaluate alerts for a batch of products.
 * Convenience wrapper for callers that already have a list of product IDs.
 * Each check is independent; failures are logged, not re-thrown.
 */
export async function evaluateAlertsForProducts(
  businessId: string,
  productIds: string[]
): Promise<void> {
  const unique = [...new Set(productIds)]
  for (const productId of unique) {
    try {
      await checkAndCreateAlerts(businessId, productId)
    } catch (err) {
      logger.error('evaluateAlertsForProducts: check failed', {
        businessId,
        productId,
        error: (err as Error).message,
      })
    }
  }
}

/** List alerts for a business with cursor pagination. */
export async function listAlerts(
  businessId: string,
  opts: ListAlertsOpts
) {
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

  const where: Record<string, unknown> = { businessId }
  if (opts.status) {
    where.status = opts.status
  }

  const [alerts, total] = await Promise.all([
    prisma.stockAlert.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            currentStock: true,
            minStockLevel: true,
            unit: { select: { name: true, symbol: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra for cursor
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
    prisma.stockAlert.count({ where }),
  ])

  const hasMore = alerts.length > limit
  if (hasMore) alerts.pop()

  const nextCursor = hasMore ? alerts[alerts.length - 1].id : null

  return { alerts, total, nextCursor }
}

/** Acknowledge an alert. */
export async function acknowledgeAlert(
  alertId: string,
  userId: string,
  businessId: string
): Promise<void> {
  await prisma.stockAlert.updateMany({
    where: {
      id: alertId,
      businessId,
      status: 'ACTIVE',
    },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    },
  })
}

/** Dismiss (resolve) an alert manually. */
export async function dismissAlert(
  alertId: string,
  businessId: string
): Promise<void> {
  await prisma.stockAlert.updateMany({
    where: {
      id: alertId,
      businessId,
      status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
    },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  })
}

/** Resolve active alerts when stock is replenished above threshold. */
async function resolveAlerts(businessId: string, productId: string): Promise<void> {
  const result = await prisma.stockAlert.updateMany({
    where: {
      businessId,
      productId,
      status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
    },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  })

  if (result.count > 0) {
    logger.info('Stock alerts auto-resolved', { productId, count: result.count })
  }
}

/** Get count of active alerts for a business (dashboard badge). */
export async function getActiveAlertCount(businessId: string): Promise<number> {
  return prisma.stockAlert.count({
    where: {
      businessId,
      status: 'ACTIVE',
    },
  })
}
