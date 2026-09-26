/** Product Search Input — SSOT backed product typeahead with instant product creation */

import React, { useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { getProducts } from '@/lib/services/product.service'
import type { ProductSummary } from '@/lib/types/product.types'
import type { ProductPick } from '../invoice.types'
import { EntitySearch } from '@/components/ui/EntitySearch'
import { useInstantAddProduct } from './useInstantAddProduct'
import { paiseToRupees } from '../invoice-format.utils'

interface ProductSearchInputProps {
  onSelect: (pick: ProductPick) => void
  addedProductIds: string[]
  autoFocus?: boolean
}

export const ProductSearchInput: React.FC<ProductSearchInputProps> = ({
  onSelect,
  addedProductIds,
  autoFocus = false,
}) => {
  const { t } = useLanguage()

  const { isCreating, addProduct } = useInstantAddProduct({
    onCreated: (createdPick) => {
      onSelect(createdPick)
    },
    onError: () => {},
  })

  const handleFetchResults = useCallback(async (query: string, signal: AbortSignal) => {
    const res = await getProducts(
      query ? { search: query, limit: 10 } : { limit: 10 },
      signal,
    )
    return res.products
  }, [])

  const handleMapToItem = useCallback(
    (product: ProductSummary) => ({
      id: product.id,
      title: product.name,
      subtitle: product.sku ? `SKU: ${product.sku}` : undefined,
      pricePaise: product.salePrice,
      isAdded: addedProductIds.includes(product.id),
    }),
    [addedProductIds],
  )

  const handleSelect = useCallback(
    (product: ProductSummary) => {
      onSelect({
        productId: product.id,
        name: product.name,
        salePrice: product.salePrice,
        taxCategoryId: product.taxCategory?.id ?? null,
      })
    },
    [onSelect],
  )

  return (
    <EntitySearch<ProductSummary>
      id="product-search-input"
      placeholder={t.searchProductNameSku || 'Search product name or SKU...'}
      autoFocus={autoFocus}
      onSelect={handleSelect}
      onFetchResults={handleFetchResults}
      mapToItem={handleMapToItem}
      entityName={t.product || 'product'}
      entityPlural="products"
      onCreateOption={addProduct}
      isCreating={isCreating}
      showLabel={false}
      keepOpenOnSelect={true}
    />
  )
}

export { paiseToRupees }
