import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useDebounce } from '@/hooks/useDebounce'
import { queryKeys } from '@/lib/query-keys'
import { SERIAL_PAGE_SIZE } from './serial-number.constants'
import type { SerialListResponse, SerialStatus } from './serial-number.types'

type Status = 'loading' | 'error' | 'success'

interface Filters {
  status: SerialStatus | 'all'
  search: string
}

export function useSerialNumbers(productId: string) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ status: 'all', search: '' })

  const debouncedSearch = useDebounce(filters.search)

  const query = useQuery({
    queryKey: queryKeys.serialNumbers.list({ productId, status: filters.status, search: debouncedSearch }),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: String(SERIAL_PAGE_SIZE) })
      if (filters.status !== 'all') params.set('status', filters.status)
      if (debouncedSearch) params.set('search', debouncedSearch)

      return api<SerialListResponse>(
        `/serial-numbers/product/${productId}?${params}`,
        { signal },
      )
    },
    enabled: Boolean(productId),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load serial numbers')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const setSearch = useCallback((term: string) => {
    setFilters((prev) => ({ ...prev, search: term }))
  }, [])

  const setStatusFilter = useCallback((value: SerialStatus | 'all') => {
    setFilters((prev) => ({ ...prev, status: value }))
  }, [])

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.serialNumbers.all() })
  }, [queryClient])

  return {
    serials: query.data?.serialNumbers ?? [],
    total: query.data?.total ?? 0,
    status,
    refetch,
    filters,
    setSearch,
    setStatusFilter,
  }
}
