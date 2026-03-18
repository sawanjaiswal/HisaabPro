/** Items Library — Hook for browsing and selecting library items */

import { useState, useMemo, useCallback } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { searchLibraryItems } from './items-library.utils'
import { ITEMS_PER_PAGE } from './items-library.constants'
import type { LibraryItem } from './items-library.types'

export function useItemsLibrary() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  const result = useMemo(
    () => searchLibraryItems(debouncedSearch, category, page, ITEMS_PER_PAGE),
    [debouncedSearch, category, page],
  )

  const handleSearch = useCallback((q: string) => {
    setSearch(q)
    setPage(1)
  }, [])

  const handleCategory = useCallback((cat: string | null) => {
    setCategory(cat)
    setPage(1)
  }, [])

  const loadMore = useCallback(() => {
    if (result.hasMore) setPage((p) => p + 1)
  }, [result.hasMore])

  return {
    search,
    category,
    items: result.items,
    total: result.total,
    hasMore: result.hasMore,
    setSearch: handleSearch,
    setCategory: handleCategory,
    loadMore,
  }
}

export type { LibraryItem }
