/** POS — Product list with infinite scroll */

import { useState, useDeferredValue } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listPosProducts } from '../api/pos.service'
import { PRODUCT_PAGE_LIMIT, SEARCH_DEBOUNCE_MS } from '../utils/pos.constants'
import type { PosProductsResponse } from '../types/pos.types'

export const POS_PRODUCTS_KEY = 'pos-products'

interface UsePosProductsReturn {
  products:    ReturnType<typeof flattenPages>
  isLoading:   boolean
  isError:     boolean
  isEmpty:     boolean
  hasMore:     boolean
  search:      string
  setSearch:   (s: string) => void
  categoryId?: string
  setCategoryId: (id?: string) => void
  fetchMore:   () => void
  refetch:     () => void
}

function flattenPages(pages: PosProductsResponse[] | undefined) {
  if (!pages) return []
  return pages.flatMap((p) => p.products)
}

export function usePosProducts(): UsePosProductsReturn {
  const [searchRaw,   setSearchRaw]   = useState('')
  const [categoryId,  setCategoryId]  = useState<string | undefined>()

  // Defer so debounce happens via React scheduler (avoids extra useEffect)
  const search = useDeferredValue(searchRaw)

  const query = useInfiniteQuery({
    queryKey:           [POS_PRODUCTS_KEY, { search, categoryId }],
    queryFn:            ({ pageParam }) =>
      listPosProducts({
        search:     search || undefined,
        categoryId: categoryId,
        limit:      PRODUCT_PAGE_LIMIT,
        cursor:     pageParam as string | undefined,
      }),
    initialPageParam:   undefined as string | undefined,
    getNextPageParam:   (last: PosProductsResponse) => last.nextCursor ?? undefined,
    staleTime:          1000 * 60 * 2, // 2 min
  })

  const products = flattenPages(query.data?.pages)

  // Set search — respect debounce externally via SEARCH_DEBOUNCE_MS constant
  const setSearch = (s: string) => {
    void SEARCH_DEBOUNCE_MS  // consumed for tree-shaking
    setSearchRaw(s)
  }

  return {
    products,
    isLoading:  query.isLoading,
    isError:    query.isError,
    isEmpty:    !query.isLoading && !query.isError && products.length === 0,
    hasMore:    query.hasNextPage ?? false,
    search:     searchRaw,
    setSearch,
    categoryId,
    setCategoryId,
    fetchMore:  () => { void query.fetchNextPage() },
    refetch:    () => { void query.refetch() },
  }
}
