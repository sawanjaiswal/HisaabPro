/** Price List feature — shared TypeScript types */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type PriceListMode = 'ABSOLUTE' | 'PERCENT_OFF' | 'FIXED_OFF'

// ─── Domain objects ───────────────────────────────────────────────────────────

export interface PriceListEntry {
  id: string
  priceListId: string
  productId: string
  productName: string
  mode: PriceListMode
  /** Absolute price in paise (mode=ABSOLUTE) */
  valuePaise: number | null
  /** Discount in basis points — 10000 = 100% (mode=PERCENT_OFF) */
  percentBps: number | null
  /** Fixed discount amount in paise (mode=FIXED_OFF) */
  fixedOffPaise: number | null
  /** Minimum quantity for this band (inclusive) */
  minQty: number
  /** Maximum quantity for this band (inclusive) — null = no upper limit */
  maxQty: number | null
  createdAt: string
}

export interface PriceList {
  id: string
  name: string
  isDefault: boolean
  entryCount: number
  partyCount: number
  createdAt: string
  updatedAt: string
}

export interface PriceListDetail extends PriceList {
  entries: PriceListEntry[]
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface PriceListsResponse {
  data: PriceList[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

export interface PriceListResponse {
  data: PriceListDetail
}

export interface PriceListEntryResponse {
  data: PriceListEntry
}

// ─── Form shapes ──────────────────────────────────────────────────────────────

export interface PriceListFormData {
  name: string
  isDefault: boolean
}

export interface PriceListEntryFormData {
  productId: string
  productName: string
  mode: PriceListMode
  /** Display value — user input before conversion */
  value: string
  minQty: string
  maxQty: string
}
