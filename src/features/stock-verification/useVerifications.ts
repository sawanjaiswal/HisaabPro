import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { VERIFICATION_PAGE_SIZE } from './stock-verification.constants'
import type { VerificationStatus, VerificationListResponse } from './stock-verification.types'

export function useVerifications() {
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | null>(null)
  const toast = useToast()
  const queryClient = useQueryClient()

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: String(VERIFICATION_PAGE_SIZE) })
    if (statusFilter) params.set('status', statusFilter)
    return params.toString()
  }, [statusFilter])

  const query = useQuery({
    queryKey: [...queryKeys.stockVerification.list(), { statusFilter }] as const,
    queryFn: ({ signal }) =>
      api<VerificationListResponse>(`/stock-verification?${queryString}`, { signal }),
  })

  const status = query.isPending
    ? 'loading' as const
    : query.isError ? 'error' as const : 'success' as const

  const error = query.isError && query.error instanceof ApiError
    ? query.error
    : null

  const createMutation = useMutation({
    mutationFn: (notes?: string) =>
      api<{ id: string }>('/stock-verification', {
        method: 'POST',
        body: JSON.stringify(notes ? { notes } : {}),
      }),
    onSuccess: () => {
      toast.success('Stock verification created')
      void queryClient.invalidateQueries({ queryKey: queryKeys.stockVerification.all() })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to create verification'
      toast.error(message)
    },
  })

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stockVerification.all() })
  }, [queryClient])

  const createVerification = useCallback(async (notes?: string) => {
    if (createMutation.isPending) return null
    try {
      const result = await createMutation.mutateAsync(notes)
      return result.id
    } catch {
      return null
    }
  }, [createMutation])

  return {
    verifications: query.data?.verifications ?? [],
    total: query.data?.total ?? 0,
    status,
    error,
    refetch,
    createVerification,
    isCreating: createMutation.isPending,
    statusFilter,
    setStatusFilter,
  }
}
