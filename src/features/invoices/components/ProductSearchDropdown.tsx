/** Dropdown list for product search — shows loading, error, empty, hint, results, and instant Add Product */

import { Text } from '@/components/ui/Text'
import React from 'react'
import { Package, Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import type { ProductSummary } from '@/lib/types/product.types'
import { ProductSearchResultItem } from './ProductSearchResultItem'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductSearchDropdownProps {
  results: ProductSummary[]
  isLoading: boolean
  fetchError: boolean
  debouncedQuery: string
  addedProductIds: string[]
  isCreating?: boolean
  onAdd: (product: ProductSummary) => void
  onAddNew?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ProductSearchDropdown: React.FC<ProductSearchDropdownProps> = ({
  results,
  isLoading,
  fetchError,
  debouncedQuery,
  addedProductIds,
  isCreating = false,
  onAdd,
  onAddNew,
}) => {
  const { t } = useLanguage()
  const trimmedQuery = debouncedQuery.trim()
  const hasQuery = trimmedQuery.length > 0

  return (
    <ul
      className="product-search-dropdown"
      role="listbox"
      aria-label={t.productSearchResults}
    >
      {isLoading && (
        <li className="product-search-status" role="status" aria-live="polite">
          <span className="product-search-spinner" aria-hidden="true" />
          {t.searching}
        </li>
      )}

      {!isLoading && fetchError && (
        <li className="product-search-status product-search-error" role="alert">
          {t.failedLoadProducts}
        </li>
      )}

      {!isLoading && !fetchError && hasQuery && results.length === 0 && (
        <li className="product-search-status product-search-empty flex flex-col items-center gap-2 py-4 px-3 text-center">
          <Text className="text-xs text-[var(--color-gray-500)] font-medium">
            {t.noProductsFoundFor} &ldquo;{debouncedQuery}&rdquo;
          </Text>
          {onAddNew && (
            <Button
              variant="none"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAddNew()
              }}
              disabled={isCreating}
              className="w-full py-2 px-3 rounded-xl bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <span className="product-search-spinner" aria-hidden="true" />
                  <span>{t.creatingProduct}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addProduct} &ldquo;{trimmedQuery}&rdquo; {t.addAsNewProduct}</span>
                </>
              )}
            </Button>
          )}
        </li>
      )}

      {!isLoading && !fetchError && !hasQuery && (
        <li className="product-search-status product-search-hint">
          <Package size={14} aria-hidden="true" />
          {t.typeToSearchProducts}
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

      {/* Quick "Add product" option at bottom when query is typed */}
      {!isLoading && !fetchError && onAddNew && hasQuery && results.length > 0 && (
        <li
          className="product-search-add-new"
          role="option"
          aria-selected={false}
          aria-busy={isCreating}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onAddNew()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onAddNew()
            }
          }}
        >
          <span className="product-search-add-icon" aria-hidden="true">
            {isCreating ? <span className="product-search-spinner" /> : <Plus size={16} />}
          </span>
          <span className="product-search-add-label truncate">
            {isCreating
              ? t.creatingProduct
              : `${t.addProduct} "${trimmedQuery}" ${t.addAsNewProduct}`}
          </span>
        </li>
      )}
    </ul>
  )
}
