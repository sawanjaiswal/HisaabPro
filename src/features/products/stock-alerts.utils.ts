/** Stock Alerts (#49) — pure severity/derivation helpers. */

import type { StockAlert, StockAlertFilter, StockSeverity } from './stock-alerts.types'

/** Half the minimum is the line between "restock soon" and "you are about to
 *  turn a customer away" — the mockup's Critical chip. */
const CRITICAL_RATIO = 0.5

export function severityOf(alert: StockAlert): StockSeverity {
  const { currentStock, minStockLevel } = alert.product
  if (currentStock <= 0) return 'OUT'
  if (currentStock <= minStockLevel * CRITICAL_RATIO) return 'CRITICAL'
  return 'LOW'
}

/** How full the stock bar is, 0-100. Products with no minimum read as full. */
export function stockPercent(alert: StockAlert): number {
  const { currentStock, minStockLevel } = alert.product
  if (minStockLevel <= 0) return currentStock > 0 ? 100 : 0
  return Math.max(0, Math.min(100, Math.round((currentStock / minStockLevel) * 100)))
}

/** Units still needed to get back to the minimum level. */
export function shortfall(alert: StockAlert): number {
  return Math.max(0, alert.product.minStockLevel - alert.product.currentStock)
}

export function matchesFilter(alert: StockAlert, filter: StockAlertFilter): boolean {
  if (filter === 'ALL') return true
  const severity = severityOf(alert)
  if (filter === 'OUT_OF_STOCK') return severity === 'OUT'
  if (filter === 'CRITICAL') return severity === 'CRITICAL'
  return severity === 'LOW'
}

export function matchesSearch(alert: StockAlert, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const { name, sku } = alert.product
  return name.toLowerCase().includes(q) || (sku ?? '').toLowerCase().includes(q)
}
