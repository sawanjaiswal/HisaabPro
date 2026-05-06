/** useStockValueReport — paginated stock value report with cursor pagination */

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export interface StockValueItem {
  productId: string
  name: string
  sku: string | null
  currentStock: number
  unit: string | null
  weightedAvgCostPaise: string  // BigInt serialised as string
  lineValuePaise: string        // BigInt serialised as string
}

export interface StockValueSummary {
  totalValuePaise: string
  productCount: number
  asOf: string
}

export interface StockValueResponse {
  items: StockValueItem[]
  summary: StockValueSummary
  nextCursor: string | null
}

const PAGE_LIMIT = 30

export function useStockValueReport() {
  const queryClient = useQueryClient()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allItems, setAllItems] = useState<StockValueItem[]>([])
  const [summary, setSummary] = useState<StockValueSummary | null>(null)

  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
  if (cursor) params.set('cursor', cursor)

  const query = useQuery({
    queryKey: queryKeys.stockValueReport.list({ cursor: cursor ?? '' }),
    queryFn: ({ signal }) =>
      api<StockValueResponse>(`/reports/stock-value?${params.toString()}`, {
        signal,
        cacheReads: true,
      }),
    staleTime: 2 * 60 * 1000,
  })

  // Merge pages
  if (query.isSuccess && query.data) {
    const incoming = query.data.items
    if (!cursor) {
      // First page — replace
      if (allItems.length !== incoming.length || allItems[0]?.productId !== incoming[0]?.productId) {
        setAllItems(incoming)
        setSummary(query.data.summary)
      }
    } else {
      // Subsequent page — append if not already there
      if (allItems.length > 0 && !allItems.find((i) => i.productId === incoming[0]?.productId)) {
        setAllItems((prev) => [...prev, ...incoming])
      }
    }
  }

  const hasMore = Boolean(query.data?.nextCursor)

  const loadMore = useCallback(() => {
    if (query.data?.nextCursor) {
      setCursor(query.data.nextCursor)
    }
  }, [query.data?.nextCursor])

  const refresh = useCallback(() => {
    setCursor(undefined)
    setAllItems([])
    setSummary(null)
    void queryClient.invalidateQueries({ queryKey: queryKeys.stockValueReport.list({}) })
  }, [queryClient])

  const status = query.isPending && allItems.length === 0
    ? 'loading' as const
    : query.isError ? 'error' as const
    : 'success' as const

  const error = query.isError && query.error instanceof ApiError ? query.error : null

  return {
    items: allItems,
    summary: summary ?? (query.data?.summary ?? null),
    hasMore,
    status,
    error,
    loadMore,
    refresh,
    isFetchingMore: query.isFetching && allItems.length > 0,
  }
}
