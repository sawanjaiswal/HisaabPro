/**
 * Phase 7 · 7.1B — Default product column mappings per import format.
 *
 * Mirrors normalize-mappings.ts (parties). Parsers emit RawProductRow
 * with canonical keys (name, sku, hsn, unit, salePrice, ...), so the
 * three known-format mappings are identity maps. GENERIC_CSV returns
 * null — the FE mapping page supplies user choices explicitly.
 */

import type { ImportFormat } from '../../../types/import.types.js'

export interface ProductColumnMapping {
  name: string
  sku?: string
  hsn?: string
  unit?: string
  salePrice?: string
  purchasePrice?: string
  mrp?: string
  openingStock?: string
  description?: string
}

const IDENTITY: ProductColumnMapping = {
  name: 'name',
  sku: 'sku',
  hsn: 'hsn',
  unit: 'unit',
  salePrice: 'salePrice',
  purchasePrice: 'purchasePrice',
  mrp: 'mrp',
  openingStock: 'openingStock',
  description: 'description',
}

export const TALLY_PRODUCT_MAPPING: ProductColumnMapping = IDENTITY
export const VYAPAR_PRODUCT_MAPPING: ProductColumnMapping = IDENTITY
export const BUSY_PRODUCT_MAPPING: ProductColumnMapping = IDENTITY

export function defaultProductMappingFor(
  format: ImportFormat,
): ProductColumnMapping | null {
  switch (format) {
    case 'TALLY_XML':
      return TALLY_PRODUCT_MAPPING
    case 'VYAPAR_CSV':
      return VYAPAR_PRODUCT_MAPPING
    case 'BUSY_XLSX':
      return BUSY_PRODUCT_MAPPING
    case 'GENERIC_CSV':
      return null
    default: {
      const _exhaustive: never = format
      void _exhaustive
      return null
    }
  }
}
