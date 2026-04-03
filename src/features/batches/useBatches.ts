/** Batch Tracking -- List hook
 *
 * Manages batch list for a given productId.
 * Fetches batches, handles delete with confirmation.
 */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { BATCH_PAGE_SIZE } from './batch.constants'
import type { BatchListResponse } from './batch.types'

interface UseBatchesReturn {
  batches: BatchListResponse | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: ApiError | null
  refetch: () => void
  deleteBatch: (id: string, batchNumber: string) => Promise<void>
  isDeleting: boolean
}

export function useBatches(productId: string | undefined): UseBatchesReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.batches.list({ productId }),
    queryFn: ({ signal }) =>
      api<BatchListResponse>(
        `/products/${productId}/batches?limit=${BATCH_PAGE_SIZE}`,
        { signal },
      ),
    enabled: Boolean(productId),
  })

  const status = !productId
    ? 'idle' as const
    : query.isPending
      ? 'loading' as const
      : query.isError ? 'error' as const : 'success' as const

  const error = query.isError && query.error instanceof ApiError
    ? query.error
    : null

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string; batchNumber: string }) =>
      api(`/batches/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, variables) => {
      toast.success(`Batch ${variables.batchNumber} deleted`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.batches.all() })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to delete batch'
      toast.error(message)
    },
  })

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.batches.all() })
  }, [queryClient])

  const deleteBatch = useCallback(async (id: string, batchNumber: string) => {
    await deleteMutation.mutateAsync({ id, batchNumber })
  }, [deleteMutation])

  return {
    batches: query.data ?? null,
    status,
    error,
    refetch,
    deleteBatch,
    isDeleting: deleteMutation.isPending,
  }
}
