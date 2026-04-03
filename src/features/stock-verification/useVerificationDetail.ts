import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import type { VerificationDetail, RecordCountData } from './stock-verification.types'

export function useVerificationDetail(id: string | undefined) {
  const [isProcessing, setIsProcessing] = useState(false)
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.stockVerification.detail(id ?? ''),
    queryFn: ({ signal }) =>
      api<VerificationDetail>(`/stock-verification/${id}`, { signal }),
    enabled: Boolean(id),
  })

  const status = !id
    ? 'idle' as const
    : query.isPending
      ? 'loading' as const
      : query.isError ? 'error' as const : 'success' as const

  const error = query.isError && query.error instanceof ApiError
    ? query.error
    : null

  const invalidateDetail = useCallback(() => {
    if (id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stockVerification.detail(id) })
    }
  }, [queryClient, id])

  const recordCountMutation = useMutation({
    mutationFn: ({ itemId, countData }: { itemId: string; countData: RecordCountData }) =>
      api(`/stock-verification/${id}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(countData),
      }),
    onSuccess: () => {
      toast.success('Count recorded')
      invalidateDetail()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to record count'
      toast.error(message)
    },
    onSettled: () => setIsProcessing(false),
  })

  const completeMutation = useMutation({
    mutationFn: (notes?: string) =>
      api(`/stock-verification/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(notes ? { notes } : {}),
      }),
    onSuccess: () => {
      toast.success('Verification completed')
      invalidateDetail()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to complete verification'
      toast.error(message)
    },
    onSettled: () => setIsProcessing(false),
  })

  const adjustMutation = useMutation({
    mutationFn: () =>
      api(`/stock-verification/${id}/adjust`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Stock adjusted successfully')
      invalidateDetail()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to adjust stock'
      toast.error(message)
    },
    onSettled: () => setIsProcessing(false),
  })

  const recordCount = useCallback(async (itemId: string, countData: RecordCountData) => {
    if (!id || recordCountMutation.isPending) return
    setIsProcessing(true)
    await recordCountMutation.mutateAsync({ itemId, countData })
  }, [id, recordCountMutation])

  const completeVerification = useCallback(async (notes?: string) => {
    if (!id || completeMutation.isPending) return
    setIsProcessing(true)
    await completeMutation.mutateAsync(notes)
  }, [id, completeMutation])

  const adjustStock = useCallback(async () => {
    if (!id || adjustMutation.isPending) return
    setIsProcessing(true)
    await adjustMutation.mutateAsync()
  }, [id, adjustMutation])

  const refetch = useCallback(() => {
    invalidateDetail()
  }, [invalidateDetail])

  return {
    verification: query.data ?? null,
    items: query.data?.items ?? [],
    status,
    error,
    refetch,
    recordCount,
    completeVerification,
    adjustStock,
    isProcessing,
  }
}
