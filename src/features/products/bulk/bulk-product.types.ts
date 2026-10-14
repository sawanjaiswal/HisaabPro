/**
 * Bulk Product Add — Type Definitions (Level 6 SSOT)
 */

export interface BulkProductRow {
  id: string
  name: string
  unitId: string
  salePrice: string
  purchasePrice: string
  openingStock: string
  minStockLevel: string
  categoryId?: string
  sku?: string
  hsnCode?: string
}

export interface BulkProductRowValidation {
  isValid: boolean
  errors: Record<string, string>
}

export interface BulkImportSummary {
  totalRows: number
  validRows: number
  invalidRows: number
}
