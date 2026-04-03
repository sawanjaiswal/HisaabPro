/** Godowns list -- Hook */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { GODOWN_PAGE_SIZE } from './godown.constants'
import type { GodownListResponse } from './godown.types'

interface UseGodownsReturn {
  data: GodownListResponse | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: ApiError | null
  refetch: () => void
  deleteGodown: (id: string, name: string) => void
  isDeleting: boolean
}

export function useGodowns(): UseGodownsReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.godowns.list(),
    queryFn: ({ signal }) =>
      api<GodownListResponse>(`/godowns?limit=${GODOWN_PAGE_SIZE}`, { signal }),
  })

  const status = query.isPending
    ? 'loading' as const
    : query.isError ? 'error' as const : 'success' as const

  const error = query.isError && query.error instanceof ApiError
    ? query.error
    : null

  const deleteMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api(`/godowns/${id}`, { method: 'DELETE', entityType: 'godown', entityLabel: name }),
    onSuccess: (_data, variables) => {
      toast.success(`${variables.name} deleted`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.godowns.all() })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to delete godown'
      toast.error(message)
    },
  })

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.godowns.all() })
  }, [queryClient])

  const deleteGodown = useCallback((id: string, name: string) => {
    if (deleteMutation.isPending) return
    deleteMutation.mutate({ id, name })
  }, [deleteMutation])

  return {
    data: query.data ?? null,
    status,
    error,
    refetch,
    deleteGodown,
    isDeleting: deleteMutation.isPending,
  }
}
