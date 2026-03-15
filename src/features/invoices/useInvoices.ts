/** Invoices — List hook
 *
 * Mirrors useProducts.ts exactly. Manages paginated document list,
 * debounced search, filter state, optimistic delete with undo toast,
 * and manual refresh via refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [filters, setFilters] = useState<DocumentFilters>({
    ...DEFAULT_DOCUMENT_FILTERS,
    type,
    status: 'SAVED,SHARED',
    sortBy: 'documentDate',
    sortOrder: 'desc',
    ...initialFilters,
  })
  const [data, setData] = useState<DocumentListResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch documents whenever filters or refreshKey change
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getDocuments(filters, controller.signal)
      .then((response: DocumentListResponse) => {
        setData(response)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load invoices'
        toast.error(message)
      })

    return () => controller.abort()
  }, [filters, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setRefreshKey((k) => k + 1)
  }, [])

  const handleDelete = useCallback((id: string, documentNumber: string) => {
    // Optimistic removal from list
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        documents: prev.documents.filter((d) => d.id !== id),
        pagination: {
          ...prev.pagination,
          total: prev.pagination.total - 1,
        },
      }
    })

    let undone = false

    toast.success(`${documentNumber} deleted`, {
      onUndo: () => {
        undone = true
        refresh()
      },
      undoLabel: 'Undo',
    })

    // Delay actual deletion to allow undo window (matches toast duration)
    const timerId = setTimeout(() => {
      if (undone) return
      deleteDocument(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete invoice'
        toast.error(message)
        refresh() // Restore list on failure
      })
    }, 5_000)

    // Cleanup on unmount is not needed here — timer is self-contained
    // and a leaked delete after unmount is safe (server state corrects on next fetch)
    void timerId
  }, [refresh, toast])

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
