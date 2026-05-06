/** useBatchPicker — fetch FEFO-ordered batches + selection state (BAT-05) */

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { BatchPickerItem, BatchPickerResponse } from '../types/batch.types'

interface UseBatchPickerOptions {
  productId: string | null
  enabled?: boolean
}

interface UseBatchPickerReturn {
  batches: BatchPickerItem[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  selectedBatchId: string | null
  selectBatch: (id: string | null) => void
  refetch: () => void
}

async function fetchBatches(productId: string): Promise<BatchPickerItem[]> {
  const res = await api<BatchPickerResponse>(
    `/products/${productId}/batches/picker?available=true`,
    { cacheReads: false },
  )
  return res.batches
}

export function useBatchPicker({
  productId,
  enabled = true,
}: UseBatchPickerOptions): UseBatchPickerReturn {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['batches', 'picker', productId],
    queryFn: () => fetchBatches(productId!),
    enabled: Boolean(productId) && enabled,
    staleTime: 0,          // stock changes fast — always fresh
    gcTime: 30_000,
  })

  const status: UseBatchPickerReturn['status'] = !productId || !enabled
    ? 'idle'
    : query.isPending
      ? 'loading'
      : query.isError
        ? 'error'
        : 'success'

  const errorMsg = query.isError
    ? query.error instanceof ApiError
      ? query.error.message
      : 'Could not load batches'
    : null

  const selectBatch = useCallback((id: string | null) => {
    setSelectedBatchId(id)
  }, [])

  const refetch = useCallback(() => {
    void query.refetch()
  }, [query])

  return {
    batches: query.data ?? [],
    status,
    error: errorMsg,
    selectedBatchId,
    selectBatch,
    refetch,
  }
}
