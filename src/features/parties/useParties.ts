import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { TIMEOUTS } from '@/config/app.config'
import { DEFAULT_FILTERS } from './party.constants'
import { getParties, createParty, deleteParty } from './party.service'
import type { PartyListResponse, PartyFilters, PartyFormData } from './party.types'

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
  setPage: (page: number) => void
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
  const [data, setData] = useState<PartyListResponse | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch parties whenever filters or refreshKey change
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getParties(filters, controller.signal)
      .then((response: PartyListResponse) => {
        setData(response)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load parties'
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

  const setFilter = useCallback(<K extends keyof PartyFilters>(key: K, value: PartyFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleCreate = useCallback(async (formData: PartyFormData) => {
    try {
      await createParty(formData)
      toast.success(`${formData.name} added successfully`)
      refresh()
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to create party'
      toast.error(message)
      throw err
    }
  }, [refresh, toast])

  const handleDelete = useCallback((id: string, name: string) => {
    // Optimistic removal from list
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        parties: prev.parties.filter((p) => p.id !== id),
        pagination: {
          ...prev.pagination,
          total: prev.pagination.total - 1,
        },
      }
    })

    let undone = false

    toast.success(`${name} deleted`, {
      onUndo: () => {
        undone = true
        refresh()
      },
      undoLabel: 'Undo',
    })

    // Delay actual deletion to allow undo window (matches toast duration)
    const timerId = setTimeout(() => {
      if (undone) return
      deleteParty(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete party'
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
    handleCreate,
    handleDelete,
  }
}
