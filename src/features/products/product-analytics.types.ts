/** Product analytics — types mirroring GET /products/:id/analytics.
 *  Amounts in PAISE (integer); quantities are floats. */

export interface ProductStockStats {
  current: number
  available: number
  reserved: number
  minStock: number
}

export interface ProductSalesSpark {
  salesValue: number[]
  unitsSold: number[]
  profit: number[]
  avgSellingPrice: number[]
}

export interface ProductSalesMetrics {
  /** Sales value this month, paise */
  salesValue: number
  unitsSold: number
  /** Profit this month, paise */
  profit: number
  /** Average selling price, paise per unit */
  avgSellingPrice: number
  spark: ProductSalesSpark
}

export interface ProductStockSummary {
  opening: number
  purchased: number
  sold: number
  returned: number
  damaged: number
  available: number
  minAlert: number
}

export interface ProductAnalytics {
  stockStats: ProductStockStats
  salesMetrics: ProductSalesMetrics
  stockSummary: ProductStockSummary
}
