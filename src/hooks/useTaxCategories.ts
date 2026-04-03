/** Shared hook -- Tax categories list (TanStack Query)
 * Used by products and tax features.
 */

import { useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { listTaxCategories, deleteTaxCategory, seedDefaultTaxCategories } from '@/lib/services/tax.service'
import type { TaxCategory } from '@/lib/types/tax.types'

type Status = 'loading' | 'error' | 'success'

export function useTaxCategories(businessId: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.tax.categories(),
    queryFn: () => listTaxCategories(businessId),
    enabled: Boolean(businessId),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load tax categories')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTaxCategory(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<TaxCategory[]>(queryKeys.tax.categories(), (prev) =>
        prev ? prev.filter((c) => c.id !== id) : [],
      )
      toast.success('Tax category deleted')
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete')
    },
  })

  const seedMutation = useMutation({
    mutationFn: (bid: string) => seedDefaultTaxCategories(bid),
    onSuccess: () => {
      toast.success('Default tax categories created')
      queryClient.invalidateQueries({ queryKey: queryKeys.tax.categories() })
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to seed defaults')
    },
  })

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tax.categories() })
  }, [queryClient])

  const remove = useCallback((id: string) => {
    deleteMutation.mutate(id)
  }, [deleteMutation])

  const seedDefaults = useCallback((bid: string) => {
    seedMutation.mutate(bid)
  }, [seedMutation])

  return { categories: query.data ?? [], status, refresh, remove, seedDefaults }
}
