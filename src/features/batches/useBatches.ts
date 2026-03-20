/** Batch Tracking — List hook
 *
 * Manages batch list for a given productId.
 * Fetches batches, handles delete with confirmation.
 */

import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
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
  const [isDeleting, setIsDeleting] = useState(false)

  const path = productId
    ? `/products/${productId}/batches?limit=${BATCH_PAGE_SIZE}`
    : null

  const { data, status, error, refetch } = useApi<BatchListResponse>(path)

  const deleteBatch = useCallback(async (id: string, batchNumber: string) => {
    setIsDeleting(true)
    try {
      await api(`/batches/${id}`, { method: 'DELETE' })
      toast.success(`Batch ${batchNumber} deleted`)
      refetch()
    } catch (err: unknown) {
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to delete batch'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }, [refetch, toast])

  return {
    batches: data,
    status,
    error,
    refetch,
    deleteBatch,
    isDeleting,
  }
}
