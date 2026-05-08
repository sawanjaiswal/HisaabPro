/** BOM feature — utilities */

import { BOM_QTY_PRECISION, BOM_STOCK_STATUS, BOM_MAX_COMPONENTS, BOM_NAME_MAX_LENGTH } from './bom.constants'
import type { BomComponentFormRow, BomFormData } from './bom.types'
import type { BomStockStatus } from './bom.constants'

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Format version as "v1", "v2", etc. */
export function formatVersionBadge(version: number): string {
  return `v${version}`
}

/** Format qty to 3-decimal precision, stripping trailing zeros */
export function formatQty(qty: number): string {
  return parseFloat(qty.toFixed(BOM_QTY_PRECISION)).toString()
}

// ─── Stock classification ─────────────────────────────────────────────────────

/** Classify stock availability for a component relative to required qty */
export function classifyStock(currentStock: number, requiredQty: number): BomStockStatus {
  if (currentStock >= requiredQty) return BOM_STOCK_STATUS.OK
  if (currentStock > 0) return BOM_STOCK_STATUS.LOW
  return BOM_STOCK_STATUS.INSUFFICIENT
}

/** Return CSS class for stock status */
export function stockStatusClass(status: BomStockStatus): string {
  switch (status) {
    case BOM_STOCK_STATUS.OK: return 'bom-stock--ok'
    case BOM_STOCK_STATUS.LOW: return 'bom-stock--low'
    case BOM_STOCK_STATUS.INSUFFICIENT: return 'bom-stock--insufficient'
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface BomValidationErrors {
  name?: string
  productId?: string
  components?: string
  rows?: Record<number, { qty?: string; productId?: string }>
}

export function validateBomForm(
  form: BomFormData,
  editProductId?: string,
): BomValidationErrors {
  const errors: BomValidationErrors = {}

  if (!form.name.trim()) errors.name = 'Recipe name is required'
  else if (form.name.length > BOM_NAME_MAX_LENGTH) errors.name = `Max ${BOM_NAME_MAX_LENGTH} characters`

  if (!form.productId) errors.productId = 'Finished product is required'

  if (form.components.length === 0) {
    errors.components = 'Add at least one component'
  } else if (form.components.length > BOM_MAX_COMPONENTS) {
    errors.components = `Maximum ${BOM_MAX_COMPONENTS} components allowed`
  }

  const rowErrors: Record<number, { qty?: string; productId?: string }> = {}
  const seenProductIds = new Set<string>()

  form.components.forEach((row, i) => {
    const rowErr: { qty?: string; productId?: string } = {}

    if (!row.componentProductId) {
      rowErr.productId = 'Select a product'
    } else if (row.componentProductId === (editProductId ?? form.productId)) {
      rowErr.productId = 'Component cannot be the same as the finished product'
    } else if (seenProductIds.has(row.componentProductId)) {
      rowErr.productId = 'This product is already added'
    } else {
      seenProductIds.add(row.componentProductId)
    }

    const qty = parseFloat(row.quantity)
    if (!row.quantity || isNaN(qty) || qty <= 0) {
      rowErr.qty = 'Quantity must be greater than 0'
    }

    if (Object.keys(rowErr).length > 0) rowErrors[i] = rowErr
  })

  if (Object.keys(rowErrors).length > 0) errors.rows = rowErrors

  return errors
}

/** Parse qty string to float, clamped to BOM_QTY_PRECISION */
export function parseQty(value: string): number {
  const n = parseFloat(value)
  if (isNaN(n)) return 0
  return parseFloat(n.toFixed(BOM_QTY_PRECISION))
}

/** Generate a stable local row ID */
export function genRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Check if form has any validation errors */
export function hasErrors(errors: BomValidationErrors): boolean {
  if (errors.name || errors.productId || errors.components) return true
  if (errors.rows && Object.keys(errors.rows).length > 0) return true
  return false
}

/** Build the API payload from form rows */
export function formRowsToComponents(rows: BomComponentFormRow[]) {
  return rows.map((r) => ({
    componentProductId: r.componentProductId,
    quantity: parseQty(r.quantity),
    unitId: r.unitId || undefined,
    notes: r.notes || undefined,
  }))
}
