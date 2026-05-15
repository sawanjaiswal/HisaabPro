/** Sales pipeline — typed list hook wrapping TanStack Query for documents?type=. */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { getSalesDocuments } from './sales-list.service'
import type { SalesDocumentType, SalesDocumentFilters, SalesFilterState } from './sales.types'
import type { DocumentListResponse } from '../invoices/invoice.types'
import { TIMEOUTS } from '@/config/app.config'

const DEFAULT_LIMIT = 20

type Status = 'loading' | 'error' | 'success'

interface UseDocumentListOptions {
  type: SalesDocumentType
}

interface UseDocumentListReturn {
  data: DocumentListResponse | null
  status: Status
  filters: SalesDocumentFilters
  filterState: SalesFilterState
  setSearch: (term: string) => void
  setStatusFilter: (status: SalesFilterState['status']) => void
  setPage: (page: number) => void
  refresh: () => void
}

export function useDocumentList({ type }: UseDocumentListOptions): UseDocumentListReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<SalesDocumentFilters>({
    type,
    page: 1,
    limit: DEFAULT_LIMIT,
    sortBy: 'documentDate',
    sortOrder: 'desc',
  })

  const [filterState, setFilterState] = useState<SalesFilterState>({
    search: '',
    status: 'ALL',
    fromDate: '',
    toDate: '',
  })

  const queryKey = ['sales-documents', filters]

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getSalesDocuments(filters, signal),
  })

  const data = query.data ?? null
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError
        ? query.error.message
        : `Failed to load ${type.toLowerCase().replace('_', ' ')}s`
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

  const setSearch = useCallback((term: string) => {
    setFilterState((prev) => ({ ...prev, search: term }))
    setPendingSearch(term)
  }, [])

  useEffect(() => {
    if (pendingSearch === null) return
    const id = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: pendingSearch || undefined, page: 1 }))
      setPendingSearch(null)
    }, TIMEOUTS.debounceMs)
    return () => clearTimeout(id)
  }, [pendingSearch])

  const setStatusFilter = useCallback((statusVal: SalesFilterState['status']) => {
    setFilterState((prev) => ({ ...prev, status: statusVal }))
    setFilters((prev) => ({
      ...prev,
      status: statusVal === 'ALL' ? undefined : statusVal,
      page: 1,
    }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sales-documents', { type }] })
  }, [queryClient, type])

  return {
    data,
    status,
    filters,
    filterState,
    setSearch,
    setStatusFilter,
    setPage,
    refresh,
  }
}
