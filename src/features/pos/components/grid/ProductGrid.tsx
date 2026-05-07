/** POS — Virtualized product grid */

import { useRef, useEffect, useCallback } from 'react'
import { PosProductCard } from './PosProductCard'
import { ProductSearchBar } from './ProductSearchBar'
import {
  ProductGridSkeleton,
  ProductGridError,
  ProductGridEmpty,
} from './ProductGridStates'
import type { PosProductDTO } from '../../types/pos.types'
import type { usePosProducts } from '../../hooks/usePosProducts'

type ProductsHook = ReturnType<typeof usePosProducts>

interface ProductGridProps {
  productsHook:   ProductsHook
  cartProductIds: Set<string>
  onSelect:       (product: PosProductDTO) => void
}

export function ProductGrid({ productsHook, cartProductIds, onSelect }: ProductGridProps) {
  const { products, isLoading, isError, isEmpty, hasMore, search, setSearch, fetchMore, refetch } =
    productsHook

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const fetchMoreRef = useRef(fetchMore)
  fetchMoreRef.current = fetchMore

  const observerCallback = useCallback<IntersectionObserverCallback>((entries) => {
    if (entries[0]?.isIntersecting) fetchMoreRef.current()
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const obs = new IntersectionObserver(observerCallback, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, observerCallback])

  return (
    <div className="pos-grid-wrap">
      <ProductSearchBar value={search} onChange={setSearch} />

      {isLoading && <ProductGridSkeleton />}

      {isError && !isLoading && (
        <ProductGridError onRetry={refetch} />
      )}

      {isEmpty && !isLoading && (
        <ProductGridEmpty search={search} />
      )}

      {!isLoading && !isError && products.length > 0 && (
        <>
          <div
            className="pos-grid"
            role="list"
            aria-label="Products"
          >
            {products.map((product) => (
              <div key={product.id} role="listitem">
                <PosProductCard
                  product={product}
                  inCart={cartProductIds.has(product.id)}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="pos-grid-sentinel" aria-hidden="true" />
          )}
        </>
      )}
    </div>
  )
}
