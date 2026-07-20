/** Stock Adjustments (mockup #48) — the business-wide manual-correction log. */

export type AdjustmentDirection = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'

/** Mirrors the row shape of GET /products/stock/adjustments. */
export interface StockAdjustment {
  id: string
  type: AdjustmentDirection
  /** Signed: positive = stock came in, negative = stock went out. */
  quantity: number
  balanceAfter: number
  reason: string | null
  customReason: string | null
  notes: string | null
  movementDate: string
  product: {
    id: string
    name: string
    unit: { symbol: string }
  }
}

export interface StockAdjustmentListResponse {
  adjustments: StockAdjustment[]
  pagination: { nextCursor: string | null }
}

/** Mockup #48's filter sheet. ALL is the default. */
export type AdjustmentFilter = 'ALL' | AdjustmentDirection
