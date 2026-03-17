/** Dropdown list for product search — shows loading, error, empty, hint, and results */

import React from 'react'
import { Package } from 'lucide-react'
import type { ProductSummary } from '@/lib/types/product.types'
import { ProductSearchResultItem } from './ProductSearchResultItem'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductSearchDropdownProps {
  results: ProductSummary[]
  isLoading: boolean
  fetchError: boolean
  debouncedQuery: string
  addedProductIds: string[]
  onAdd: (product: ProductSummary) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ProductSearchDropdown: React.FC<ProductSearchDropdownProps> = ({
  results,
  isLoading,
  fetchError,
  debouncedQuery,
  addedProductIds,
  onAdd,
}) => {
  const hasQuery = debouncedQuery.trim().length > 0

  return (
    <ul
      className="product-search-dropdown"
      role="listbox"
      aria-label="Product search results"
    >
      {isLoading && (
        <li className="product-search-status" role="status" aria-live="polite">
          <span className="product-search-spinner" aria-hidden="true" />
          Searching...
        </li>
      )}

      {!isLoading && fetchError && (
        <li className="product-search-status product-search-error" role="alert">
          Failed to load products. Try again.
        </li>
      )}

      {!isLoading && !fetchError && hasQuery && results.length === 0 && (
        <li className="product-search-status product-search-empty">
          No products found for &ldquo;{debouncedQuery}&rdquo;
        </li>
      )}

      {!isLoading && !fetchError && !hasQuery && (
        <li className="product-search-status product-search-hint">
          <Package size={14} aria-hidden="true" />
          Type to search products
        </li>
      )}

      {!isLoading && results.map((product) => (
        <ProductSearchResultItem
          key={product.id}
          product={product}
          isAdded={addedProductIds.includes(product.id)}
          onAdd={onAdd}
        />
      ))}
    </ul>
  )
}
