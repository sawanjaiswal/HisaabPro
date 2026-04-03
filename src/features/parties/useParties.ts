import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<PartyFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  })

  // TanStack Query replaces useState(data) + useEffect(fetch) + refreshKey
  const query = useQuery({
    queryKey: queryKeys.parties.list(filters),
    queryFn: ({ signal }) => getParties(filters, signal),
  })

  const data = query.data ?? null
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load parties'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.parties.all() })
  }, [queryClient])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formData: PartyFormData) => createParty(formData),
    onSuccess: (_result, formData) => {
      toast.success(`${formData.name} added successfully`)
      queryClient.invalidateQueries({ queryKey: queryKeys.parties.all() })
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to create party'
      toast.error(message)
    },
  })

  const handleCreate = useCallback(async (formData: PartyFormData) => {
    await createMutation.mutateAsync(formData)
  }, [createMutation])

  // Delete with undo (keeps existing UX: delay actual delete for 5s undo window)
  const handleDelete = useCallback((id: string, name: string) => {
    // Optimistic: update cache directly
    queryClient.setQueryData<PartyListResponse>(
      queryKeys.parties.list(filters),
      (old) => {
        if (!old) return old
        return {
          ...old,
          parties: old.parties.filter((p) => p.id !== id),
          pagination: { ...old.pagination, total: old.pagination.total - 1 },
        }
      }
    )

    let undone = false

    toast.success(`${name} deleted`, {
      onUndo: () => {
        undone = true
        queryClient.invalidateQueries({ queryKey: queryKeys.parties.all() })
      },
      undoLabel: 'Undo',
    })

    setTimeout(() => {
      if (undone) return
      deleteParty(id).catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete party'
        toast.error(message)
        queryClient.invalidateQueries({ queryKey: queryKeys.parties.all() })
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
    handleCreate,
    handleDelete,
  }
}
