/** Invoices — List hook
 *
 * TanStack Query v5 migration. Manages paginated document list,
 * debounced search, filter state, optimistic delete with undo toast.
 * Query replaces useState(data) + useEffect(fetch) + refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_DOCUMENT_FILTERS } from './invoice.constants'
import { getDocuments, deleteDocument } from './invoice.service'
import type {
  DocumentListResponse,
  DocumentFilters,
  DocumentType,
} from './invoice.types'

type Status = 'loading' | 'error' | 'success'

interface UseInvoicesOptions {
  /** Document type this list manages. Defaults to SALE_INVOICE. */
  type?: DocumentType
  initialFilters?: Partial<DocumentFilters>
}

interface UseInvoicesReturn {
  data: DocumentListResponse | null
  status: Status
  filters: DocumentFilters
  setSearch: (term: string) => void
  setFilter: <K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]) => void
  setPage: (page: number) => void
  refresh: () => void
  handleDelete: (id: string, documentNumber: string) => void
}

export function useInvoices({
  type = 'SALE_INVOICE',
  initialFilters,
}: UseInvoicesOptions = {}): UseInvoicesReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<DocumentFilters>({
    ...DEFAULT_DOCUMENT_FILTERS,
    type,
    status: 'SAVED,SHARED',
    sortBy: 'documentDate',
    sortOrder: 'desc',
    ...initialFilters,
  })

  // TanStack Query replaces useState(data) + useEffect(fetch) + refreshKey
  const query = useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: ({ signal }) => getDocuments(filters, signal),
  })

  const data = query.data ?? null
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load invoices'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search — holds the raw input, effect fires API after 300ms idle
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)

  const setSearch = useCallback((term: string) => {
    setPendingSearch(term)
  }, [])

  useEffect(() => {
    if (pendingSearch === null) return
    const timerId = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: pendingSearch, page: 1 }))
      setPendingSearch(null)
    }, TIMEOUTS.debounceMs)
    return () => clearTimeout(timerId)
  }, [pendingSearch])

  const setFilter = useCallback(<K extends keyof DocumentFilters>(
    key: K,
    value: DocumentFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
  }, [queryClient])

  const handleDelete = useCallback((id: string, documentNumber: string) => {
    // Optimistic: update cache directly
    queryClient.setQueryData<DocumentListResponse>(
      queryKeys.invoices.list(filters),
      (old) => {
        if (!old) return old
        return {
          ...old,
          documents: old.documents.filter((d) => d.id !== id),
          pagination: { ...old.pagination, total: old.pagination.total - 1 },
        }
      }
    )

    let undone = false

    toast.success(`${documentNumber} deleted`, {
      onUndo: () => {
        undone = true
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      },
      undoLabel: 'Undo',
    })

    // Delay actual deletion to allow undo window (matches toast duration)
    setTimeout(() => {
      if (undone) return
      deleteDocument(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete invoice'
        toast.error(message)
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      })
    }, 5_000)
  }, [filters, queryClient, toast])

  return {
    data,
    status,
    filters,
    setSearch,
    setFilter,
    setPage,
    refresh,
    handleDelete,
  }
}
