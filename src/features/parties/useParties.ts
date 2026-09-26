import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_FILTERS } from './party.constants'
import { getParties, createParty, deleteParty } from './party.service'
import { queuedSuffix } from '@/lib/offline.feedback'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { PartyRepository } from '@/repositories/party.repository'
import type { PartyListResponse, PartyFilters, PartyFormData, PartySummary } from './party.types'

type Status = 'loading' | 'error' | 'success'

interface UsePartiesOptions {
  initialFilters?: Partial<PartyFilters>
}

interface UsePartiesReturn {
  data: PartyListResponse | null
  status: Status
  filters: PartyFilters
  setSearch: (term: string) => void
  setFilter: <K extends keyof PartyFilters>(key: K, value: PartyFilters[K]) => void
  hasMore: boolean
  loadMore: () => void
  isLoadingMore: boolean
  refresh: () => void
  handleCreate: (formData: PartyFormData) => Promise<void>
  handleDelete: (id: string, name: string) => void
}

export function useParties({ initialFilters }: UsePartiesOptions = {}): UsePartiesReturn {
  const toast = useToast()

  const [filters, setFilters] = useState<PartyFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  })

  // Accumulated pages list for infinite scrolling
  const [accumulatedParties, setAccumulatedParties] = useState<PartySummary[]>([])
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  // 0ms Live Query with automatic fallback to getParties service
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useLiveQuery(
    ['parties', filters.page, filters.limit, filters.search, filters.type],
    async () => {
      try {
        const repo = new PartyRepository()
        const local = await repo.list(filters)
        if (local.parties.length > 0) {
          return local
        }
      } catch {}
      return getParties(filters)
    }
  )

  // Accumulate pages when loading more
  useEffect(() => {
    if (!rawData) return
    if (filters.page === 1) {
      setAccumulatedParties(rawData.parties)
      setRemovedIds(new Set())
    } else {
      setAccumulatedParties((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const newParties = rawData.parties.filter((p) => !existingIds.has(p.id))
        return [...prev, ...newParties]
      })
    }
  }, [rawData, filters.page])

  // Compute final data with optimistic deletions applied
  const data = useMemo<PartyListResponse | null>(() => {
    if (!rawData) return null
    const filteredParties = accumulatedParties.filter((p) => !removedIds.has(p.id))
    const removedCount = removedIds.size
    return {
      parties: filteredParties,
      pagination: {
        ...rawData.pagination,
        total: Math.max(0, rawData.pagination.total - removedCount),
      },
      summary: rawData.summary,
    }
  }, [rawData, accumulatedParties, removedIds])

  const status: Status = isLoading && !data ? 'loading' : error ? 'error' : 'success'

  // Show toast on fetch error
  const prevErrorRef = useRef<Error | null>(null)
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      prevErrorRef.current = error
      const message = error instanceof ApiError ? error.message : 'Failed to load parties'
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

  const setFilter = useCallback(<K extends keyof PartyFilters>(key: K, value: PartyFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const hasMore = (data?.pagination?.page ?? 1) < (data?.pagination?.totalPages ?? 1)

  const loadMore = useCallback(() => {
    if (hasMore) {
      setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
    }
  }, [hasMore])

  const refresh = useCallback(() => {
    refetch()
  }, [refetch])

  // <1ms Optimistic Create Mutation via Service + Repository
  const handleCreate = useCallback(async (formData: PartyFormData) => {
    try {
      const created = await createParty(formData)
      toast.success(queuedSuffix(`${formData.name} added successfully`))
      if (created) {
        refetch()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create party')
    }
  }, [refetch, toast])

  // <1ms Optimistic Delete with undo window
  const handleDelete = useCallback((id: string, name: string) => {
    let undone = false
    setRemovedIds((prev) => new Set(prev).add(id))

    toast.success(`${name} deleted`, {
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
      deleteParty(id)
        .then(() => refetch())
        .catch((err: any) => {
          setRemovedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          const message = err instanceof ApiError ? err.message : 'Failed to delete party'
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
    hasMore,
    loadMore,
    isLoadingMore: false,
    refresh,
    handleCreate,
    handleDelete,
  }
}
