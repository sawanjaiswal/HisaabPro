import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_DOCUMENT_FILTERS } from './invoice.constants'
import { getDocuments, deleteDocument } from './invoice.service'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { InvoiceRepository } from '@/repositories/invoice.repository'
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

  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  // 0ms Live Query with automatic fallback to getDocuments service
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useLiveQuery(
    ['invoices', filters.page, filters.limit, filters.search, filters.type, filters.status],
    async () => {
      try {
        const repo = new InvoiceRepository()
        const local = await repo.list(filters)
        if (local.documents.length > 0) {
          return local
        }
      } catch {}
      return getDocuments(filters)
    }
  )

  // Apply optimistic deletions
  const data = useMemo<DocumentListResponse | null>(() => {
    if (!rawData) return null
    const filteredDocs = rawData.documents.filter((d) => !removedIds.has(d.id))
    const removedCount = rawData.documents.length - filteredDocs.length
    return {
      documents: filteredDocs,
      pagination: {
        ...rawData.pagination,
        total: Math.max(0, rawData.pagination.total - removedCount),
      },
      summary: rawData.summary,
    }
  }, [rawData, removedIds])

  const status: Status = isLoading && !data ? 'loading' : error ? 'error' : 'success'

  // Show toast on fetch error
  const prevErrorRef = useRef<Error | null>(null)
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      prevErrorRef.current = error
      const message = error instanceof ApiError ? error.message : 'Failed to load invoices'
      toast.error(message)
    }
  }, [error, toast])

  // Debounced search
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

  const setFilter = useCallback(<K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    refetch()
  }, [refetch])

  // <1ms Optimistic Delete with undo window
  const handleDelete = useCallback((id: string, documentNumber: string) => {
    let undone = false
    setRemovedIds((prev) => new Set(prev).add(id))

    toast.success(`${documentNumber} deleted`, {
      onUndo: () => {
        undone = true
        setRemovedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        refetch()
      },
      undoLabel: 'Undo',
    })

    setTimeout(() => {
      if (undone) return
      deleteDocument(id)
        .then(() => refetch())
        .catch((err: any) => {
          setRemovedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          const message = err instanceof ApiError ? err.message : 'Failed to delete document'
          toast.error(message)
          refetch()
        })
    }, 5_000)
  }, [refetch, toast])

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
