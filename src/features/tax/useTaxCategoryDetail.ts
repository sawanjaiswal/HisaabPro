/** Tax — Single tax category detail hook (TanStack Query) */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError, api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { TaxCategory } from './tax.types'

type Status = 'loading' | 'error' | 'success'

export function useTaxCategoryDetail(id: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.tax.detail(id),
    queryFn: ({ signal }) => api<TaxCategory>(`/tax-categories/${id}`, { signal }),
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load tax category')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tax.detail(id) })
  }

  return { category: query.data ?? null, status, refresh }
}
