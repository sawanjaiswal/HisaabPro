/** Product Detail — Overview tab: pricing + inventory info rows */

import { IndianRupee, Package, Warehouse, Receipt } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductDetail } from '../product.types'
import { formatProductPrice } from '../product.utils'
import { PREDEFINED_CATEGORIES, PREDEFINED_UNITS, STOCK_VALIDATION_LABELS } from '../product.constants'
import { ProductPricePreviewPanel } from './ProductPricePreviewPanel'

interface ProductOverviewTabProps {
  product: ProductDetail
}

export function ProductOverviewTab({ product }: ProductOverviewTabProps) {
  const { t } = useLanguage()

  const categoryName = PREDEFINED_CATEGORIES.find((c) => c.id === product.category.id)?.name ?? product.category.name
  const unitName = PREDEFINED_UNITS.find((u) => u.id === product.unit.id)?.name ?? product.unit.name
  const marginPercent = product.purchasePrice && product.purchasePrice > 0 && product.salePrice > 0
    ? Math.round(((product.salePrice - product.purchasePrice) / product.salePrice) * 100)
    : null

  return (
    <>
      <div className="card product-info-card">
        <span className="product-info-section-label">{t.pricingSection}</span>
        <div className="product-info-row">
          <IndianRupee className="product-info-icon" aria-hidden="true" />
          <span className="product-info-label">{t.salePriceLabel}</span>
          <span className="product-info-value product-info-value--bold">{formatProductPrice(product.salePrice)}</span>
        </div>
        <div className="product-info-row">
          <IndianRupee className="product-info-icon" aria-hidden="true" />
          <span className="product-info-label">{t.purchasePriceLabel}</span>
          <span className="product-info-value">
            {product.purchasePrice !== null ? formatProductPrice(product.purchasePrice) : t.notSet}
          </span>
        </div>
        {marginPercent !== null && (
          <div className="product-info-row">
            <IndianRupee className="product-info-icon" aria-hidden="true" />
            <span className="product-info-label">{t.marginLabel}</span>
            <span className="product-info-value product-info-value--bold" style={{ color: 'var(--color-success-600)' }}>
              {marginPercent}%
            </span>
          </div>
        )}
      </div>

      <div className="card product-info-card">
        <span className="product-info-section-label">{t.inventorySection}</span>
        <div className="product-info-row">
          <Package className="product-info-icon" aria-hidden="true" />
          <span className="product-info-label">{t.categoryLabel}</span>
          <span className="product-info-value">{categoryName}</span>
        </div>
        <div className="product-info-row">
          <Warehouse className="product-info-icon" aria-hidden="true" />
          <span className="product-info-label">{t.unitLabel}</span>
          <span className="product-info-value">{unitName} ({product.unit.symbol})</span>
        </div>
        <div className="product-info-row">
          <Warehouse className="product-info-icon" aria-hidden="true" />
          <span className="product-info-label">{t.minStockLabel}</span>
          <span className="product-info-value">
            {product.minStockLevel > 0 ? `${product.minStockLevel} ${product.unit.symbol}` : t.notSet}
          </span>
        </div>
        <div className="product-info-row">
          <Receipt className="product-info-icon" aria-hidden="true" />
          <span className="product-info-label">{t.validationLabel}</span>
          <span className="product-info-value">{STOCK_VALIDATION_LABELS[product.stockValidation]}</span>
        </div>
      </div>

      <ProductPricePreviewPanel
        productId={product.id}
        salePrice={product.salePrice}
      />
    </>
  )
}
