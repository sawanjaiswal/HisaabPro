/** Label Print — shared type definitions */

import type { BarcodeFormat } from '@/lib/types/product.types'

export type LabelTemplate = 'standard' | 'compact' | 'barcode-only'

export type SheetFormat = 'THERMAL_40x30' | 'A4_3x8' | 'A5_2x5'

export interface LabelItem {
  id: string
  name: string
  sku: string | null
  salePrice: number          // paise integer
  imageUrl: string | null
  unit: string
  category: string | null
  template: LabelTemplate
  barcode: string | null
  barcodeFormat: BarcodeFormat | null
}

export interface LabelOptions {
  sheetFormat: SheetFormat
  templateOverride: LabelTemplate | 'per-product'
}

export interface LabelDataResponse {
  labels: LabelItem[]
  count: number
}
