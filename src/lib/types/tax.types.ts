/** Shared tax types — used by products and tax features */

/** Configurable GST rate assigned to products */
export interface TaxCategory {
  id: string
  businessId: string
  name: string           // "GST 18%", "GST 5%", "Exempt"
  rate: number           // basis points (1800 = 18%)
  cessRate: number       // basis points
  cessType: 'PERCENTAGE' | 'FIXED_PER_UNIT'
  hsnCode: string | null
  sacCode: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}
