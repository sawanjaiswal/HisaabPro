/** Shared product types — used by invoices and products features */

export type ProductStatus = 'ACTIVE' | 'INACTIVE'

/** Supported barcode formats for product identification */
export type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39' | 'UPC'

/** Product summary in list view */
export interface ProductSummary {
  id: string
  name: string
  sku: string
  /** Barcode value (scannable string) — optional */
  barcode?: string
  /** Barcode format — defaults to CODE128 */
  barcodeFormat?: BarcodeFormat
  category: { id: string; name: string }
  unit: { id: string; name: string; symbol: string }
  /** Sale price in PAISE */
  salePrice: number
  /** Purchase price in PAISE — optional, for profit tracking */
  purchasePrice: number | null
  currentStock: number    // in base unit
  minStockLevel: number   // 0 means no alert
  status: ProductStatus
  /** Phase 2 GST — associated tax category */
  taxCategory?: { id: string; name: string; rate: number } | null
  createdAt: string
}
