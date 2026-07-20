/**
 * Product analytics — read-only aggregation for the product detail page.
 *
 * All numbers are derived from existing tables (no schema change):
 *   - salesMetrics : this-month totals + daily sparkline series from
 *                    DocumentLineItem joined to SALE_INVOICE Documents.
 *   - stockSummary : lifetime movement breakdown from StockMovement.
 *   - stockStats   : current / reserved (open SALE_ORDER lines) / available / min.
 *
 * Amounts in PAISE (integer). Quantities are floats (kg/ltr support).
 */

import { prisma } from '../../lib/prisma.js'

export interface ProductAnalytics {
  stockStats: {
    current: number
    available: number
    reserved: number
    minStock: number
  }
  salesMetrics: {
    salesValue: number // paise, this month
    unitsSold: number
    profit: number // paise
    avgSellingPrice: number // paise per unit
    spark: {
      salesValue: number[]
      unitsSold: number[]
      profit: number[]
      avgSellingPrice: number[]
    }
  }
  stockSummary: {
    opening: number
    purchased: number
    sold: number
    returned: number
    damaged: number
    available: number
    minAlert: number
  }
}

type SalesDayRow = { day: string; sales_value: number; units_sold: number; profit: number }
type MovementRow = { type: string; reason: string | null; qty: number }

/** First day of the current month at 00:00 (server local — matches documentDate storage). */
function monthBounds(now = new Date()): { start: Date; nextMonth: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { start, nextMonth }
}

/** Build a zero-filled per-day series for the current month up to today. */
function dailySeries(rows: SalesDayRow[], now = new Date()) {
  const dayCount = now.getDate() // 1..31 — days elapsed this month
  const byDay = new Map<number, SalesDayRow>()
  for (const r of rows) {
    const d = new Date(r.day).getDate()
    byDay.set(d, r)
  }
  const salesValue: number[] = []
  const unitsSold: number[] = []
  const profit: number[] = []
  const avgSellingPrice: number[] = []
  for (let d = 1; d <= dayCount; d++) {
    const r = byDay.get(d)
    const sv = Number(r?.sales_value ?? 0)
    const us = Number(r?.units_sold ?? 0)
    const pf = Number(r?.profit ?? 0)
    salesValue.push(sv)
    unitsSold.push(us)
    profit.push(pf)
    avgSellingPrice.push(us > 0 ? Math.round(sv / us) : 0)
  }
  // AreaChart needs ≥2 points; pad a leading 0 when the month just started.
  const pad = (arr: number[]) => (arr.length >= 2 ? arr : [0, ...arr])
  return {
    salesValue: pad(salesValue),
    unitsSold: pad(unitsSold),
    profit: pad(profit),
    avgSellingPrice: pad(avgSellingPrice),
  }
}

export async function getProductAnalytics(
  businessId: string,
  productId: string
): Promise<ProductAnalytics> {
  const { start, nextMonth } = monthBounds()

  const [product, salesRows, movementRows, reservedRow] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, businessId },
      select: { currentStock: true, minStockLevel: true },
    }),
    prisma.$queryRaw<SalesDayRow[]>`
      SELECT DATE(d."documentDate") AS day,
             COALESCE(SUM(li."lineTotal"), 0)::bigint AS sales_value,
             COALESCE(SUM(li.quantity), 0)::float     AS units_sold,
             COALESCE(SUM(li.profit), 0)::bigint      AS profit
      FROM "DocumentLineItem" li
      JOIN "Document" d ON d.id = li."documentId"
      WHERE li."productId" = ${productId}
        AND d."businessId" = ${businessId}
        AND d.type = 'SALE_INVOICE'
        AND d.status NOT IN ('DRAFT', 'DELETED')
        AND d."deletedAt" IS NULL
        AND d."documentDate" >= ${start}
        AND d."documentDate" < ${nextMonth}
      GROUP BY DATE(d."documentDate")
      ORDER BY day ASC`,
    prisma.$queryRaw<MovementRow[]>`
      SELECT type, reason, COALESCE(SUM(quantity), 0)::float AS qty
      FROM "StockMovement"
      WHERE "productId" = ${productId} AND "businessId" = ${businessId}
      GROUP BY type, reason`,
    prisma.$queryRaw<[{ reserved: number }]>`
      SELECT COALESCE(SUM(li.quantity), 0)::float AS reserved
      FROM "DocumentLineItem" li
      JOIN "Document" d ON d.id = li."documentId"
      WHERE li."productId" = ${productId}
        AND d."businessId" = ${businessId}
        AND d.type = 'SALE_ORDER'
        AND d.status IN ('SAVED', 'SHARED')
        AND d."deletedAt" IS NULL`,
  ])

  const current = product?.currentStock ?? 0
  const minStock = product?.minStockLevel ?? 0
  const reserved = Math.max(0, Number(reservedRow[0]?.reserved ?? 0))
  const available = Math.max(0, current - reserved)

  // Sales totals (paise) from the daily rows.
  const salesValue = salesRows.reduce((s, r) => s + Number(r.sales_value), 0)
  const unitsSold = salesRows.reduce((s, r) => s + Number(r.units_sold), 0)
  const profit = salesRows.reduce((s, r) => s + Number(r.profit), 0)
  const avgSellingPrice = unitsSold > 0 ? Math.round(salesValue / unitsSold) : 0

  // Movement breakdown.
  const sumWhere = (pred: (r: MovementRow) => boolean) =>
    movementRows.filter(pred).reduce((s, r) => s + Number(r.qty), 0)
  const opening = sumWhere((r) => r.type === 'OPENING')
  const purchased = sumWhere((r) => r.type === 'PURCHASE')
  const sold = Math.abs(sumWhere((r) => r.type === 'SALE'))
  const returned = movementRows
    .filter((r) => r.type === 'RETURN_IN' || r.type === 'RETURN_OUT')
    .reduce((s, r) => s + Math.abs(Number(r.qty)), 0)
  const damaged = Math.abs(sumWhere((r) => r.reason === 'DAMAGE'))

  return {
    stockStats: { current, available, reserved, minStock },
    salesMetrics: {
      salesValue,
      unitsSold,
      profit,
      avgSellingPrice,
      spark: dailySeries(salesRows),
    },
    stockSummary: {
      opening,
      purchased,
      sold,
      returned,
      damaged,
      available,
      minAlert: minStock,
    },
  }
}
