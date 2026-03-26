/** Single product result row in the search dropdown */

import React from 'react'
import { Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductSummary } from '@/lib/types/product.types'
import { formatCurrency } from '@/lib/format'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductSearchResultItemProps {
  product: ProductSummary
  isAdded: boolean
  onAdd: (product: ProductSummary) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ProductSearchResultItem: React.FC<ProductSearchResultItemProps> = ({
  product,
  isAdded,
  onAdd,
}) => {
  const { t } = useLanguage()
  const stockLabel =
    product.currentStock <= 0
      ? t.outOfStockLabel
      : `${product.currentStock} ${product.unit.symbol}`

  return (
    <li
      key={product.id}
      className={`product-search-result${isAdded ? ' product-search-result--added' : ''}`}
      role="option"
      aria-selected={isAdded}
      aria-label={`${product.name}, ${formatCurrency(product.salePrice)}, ${t.stockLabel}: ${stockLabel}${isAdded ? `, ${t.alreadyAddedSuffix}` : ''}`}
    >
      <div className="product-search-result-info">
        <div className="product-search-result-name">{product.name}</div>
        <div className="product-search-result-meta">
          {product.sku && (
            <span className="product-search-result-sku">{product.sku}</span>
          )}
          <span className="product-search-result-stock">
            {stockLabel}
          </span>
        </div>
      </div>
      <div className="product-search-result-right">
        <span className="product-search-result-price">
          {formatCurrency(product.salePrice)}
        </span>
        <button
          type="button"
          className={`product-search-add-btn${isAdded ? ' product-search-add-btn--added' : ''}`}
          onClick={() => !isAdded && onAdd(product)}
          disabled={isAdded}
          aria-label={isAdded ? `${product.name} ${t.alreadyAddedSuffix}` : `${t.add} ${product.name}`}
        >
          {isAdded ? (
            t.addedLabel
          ) : (
            <>
              <Plus size={14} aria-hidden="true" />
              {t.add}
            </>
          )}
        </button>
      </div>
    </li>
  )
}
