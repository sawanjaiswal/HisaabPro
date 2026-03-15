/** Basic Inventory — Pure utility functions
 *
 * No hooks, no side effects. All functions: input → output.
 * All monetary params/return values in PAISE unless noted.
 */

import {
  PRODUCT_AVATAR_COLORS,
  SKU_PREFIX,
  SKU_SEPARATOR,
  SKU_PADDING,
  STOCK_STATUS_COLORS,
  STOCK_MOVEMENT_TYPE_LABELS,
  STOCK_ADJUST_REASON_LABELS,
} from './product.constants'
import type { StockMovementType, StockAdjustReason, StockStatus } from './product.types'

// ─── Price formatting ─────────────────────────────────────────────────────────

/**
 * Format paise amount as rupee string with Indian numbering system.
 * 1400 → "₹14.00"   |   150000 → "₹1,500.00"   |   10000000 → "₹1,00,000.00"
 */
export function formatProductPrice(paise: number): string {
  const rupees = paise / 100
  return rupees.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format paise amount as compact rupee string without currency symbol.
 * 150000 → "1,500.00"
 * Useful for table cells where "₹" is shown as a column header.
 */
export function formatPriceCompact(paise: number): string {
  const rupees = paise / 100
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ─── Stock formatting ─────────────────────────────────────────────────────────

/**
 * Format stock quantity with unit symbol.
 * formatStock(45, 'pcs') → "45 pcs"
 * formatStock(2.5, 'kg') → "2.5 kg"
 */
export function formatStock(qty: number, symbol: string): string {
  const formatted = Number.isInteger(qty)
    ? qty.toString()
    : qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })
  return `${formatted} ${symbol}`
}

// ─── Stock status ─────────────────────────────────────────────────────────────

/**
 * Derive stock badge status.
 * out  → currentStock <= 0
 * low  → currentStock > 0 AND currentStock < minStockLevel (only when minStockLevel > 0)
 * ok   → otherwise
 */
export function getStockStatus(current: number, min: number): StockStatus {
  if (current <= 0) return 'out'
  if (min > 0 && current < min) return 'low'
  return 'ok'
}

/**
 * Map stock status to a CSS variable color string.
 * Returns value from STOCK_STATUS_COLORS so no raw hex escapes into JSX.
 */
export function getStockColor(status: StockStatus): string {
  return STOCK_STATUS_COLORS[status]
}

// ─── SKU generation ───────────────────────────────────────────────────────────

/**
 * Generate a zero-padded SKU from prefix and counter.
 * generateSku('PRD', 1)   → "PRD-0001"
 * generateSku('PRD', 100) → "PRD-0100"
 * generateSku('PRD', 9999)→ "PRD-9999"
 * generateSku('PRD', 10000)→ "PRD-10000" (no truncation, grows naturally)
 */
export function generateSku(prefix: string, counter: number): string {
  const padded = counter.toString().padStart(SKU_PADDING, '0')
  return `${prefix}${SKU_SEPARATOR}${padded}`
}

/**
 * Generate SKU using the default prefix from constants.
 * generateDefaultSku(42) → "PRD-0042"
 */
export function generateDefaultSku(counter: number): string {
  return generateSku(SKU_PREFIX, counter)
}

// ─── Product avatar ───────────────────────────────────────────────────────────

/**
 * Get first-two-character initials for the product avatar.
 * "Maggi Noodles" → "MN"
 * "Sugar"         → "SU"
 * "A"             → "A "  (padded to 2)
 */
export function getProductInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase().padEnd(2, ' ')
}

/**
 * Deterministic CSS-var color from product name hash.
 * Same name always produces the same color across sessions.
 */
export function getProductAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PRODUCT_AVATAR_COLORS[Math.abs(hash) % PRODUCT_AVATAR_COLORS.length]
}

// ─── Paise ↔ rupees conversion ────────────────────────────────────────────────

/**
 * Convert paise integer to rupees float.
 * paiseToRupees(14900) → 149.00
 * Used for form field pre-population only — do NOT use for display (use formatProductPrice).
 */
export function paiseToRupees(paise: number): number {
  return paise / 100
}

/**
 * Convert rupees float to paise integer for storage.
 * Math.round prevents floating-point drift: 14.99 * 100 = 1498.9999…
 * rupeesToPaise(14.99) → 1499
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

// ─── Label helpers ────────────────────────────────────────────────────────────

/**
 * Human-readable stock movement type.
 * formatMovementType('ADJUSTMENT_IN') → "Stock In"
 */
export function formatMovementType(type: StockMovementType): string {
  return STOCK_MOVEMENT_TYPE_LABELS[type]
}

/**
 * Human-readable stock adjustment reason.
 * formatAdjustReason('AUDIT') → "Audit correction"
 */
export function formatAdjustReason(reason: StockAdjustReason): string {
  return STOCK_ADJUST_REASON_LABELS[reason]
}

// ─── Stock value ──────────────────────────────────────────────────────────────

/**
 * Calculate stock value for a single product (in paise).
 * stockValue(100, 12) → 1200  (100 units × Rs 0.12 purchase price)
 * Returns 0 when purchasePrice is null (price not configured).
 */
export function stockValue(currentStock: number, purchasePricePaise: number | null): number {
  if (purchasePricePaise === null) return 0
  return Math.round(currentStock * purchasePricePaise)
}

// ─── Stock deficit ────────────────────────────────────────────────────────────

/**
 * How many units below minimum (positive = deficit, 0 = ok).
 * stockDeficit(5, 20) → 15   (need 15 more to reach min level)
 * stockDeficit(30, 20) → 0   (above minimum, no deficit)
 */
export function stockDeficit(current: number, min: number): number {
  return Math.max(0, min - current)
}

// ─── Unit conversion ──────────────────────────────────────────────────────────

/**
 * Convert a quantity from one unit to another using a known factor.
 * convertQty(2, 12) → 24  (2 boxes × 12 pcs/box = 24 pcs)
 * Returns null if factor is zero or negative (invalid conversion).
 */
export function convertQty(qty: number, factor: number): number | null {
  if (factor <= 0) return null
  return qty * factor
}

/**
 * Calculate inverse factor for the reverse direction of a unit conversion.
 * inverseConversionFactor(12) → 0.0833…  (1 pcs = 1/12 box)
 * Returns null if factor is zero.
 */
export function inverseConversionFactor(factor: number): number | null {
  if (factor === 0) return null
  return 1 / factor
}

// ─── Price with unit conversion ───────────────────────────────────────────────

/**
 * Auto-calculate price per alternative unit from base-unit price.
 * priceForUnit(500, 12) → 6000  (Rs 5/pcs base → Rs 60/box, stored in paise)
 */
export function priceForUnit(basePricePaise: number, conversionFactor: number): number {
  return Math.round(basePricePaise * conversionFactor)
}
