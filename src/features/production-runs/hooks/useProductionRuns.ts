/** useProductionRuns — list + detail hooks (TanStack Query) */

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { listProductionRuns, getProductionRun } from '../production-run.service'
import type { ProductionRunListFilters } from '../production-run.types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const prKeys = {
  all: () => ['production-runs'] as const,
  list: (f: ProductionRunListFilters) => ['production-runs', 'list', f] as const,
  detail: (id: string) => ['production-runs', 'detail', id] as const,
}

// ─── useProductionRunList ────────────────────────────────────────────────────

export function useProductionRunList(filters: ProductionRunListFilters) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: prKeys.list(filters),
    queryFn: ({ signal }) => listProductionRuns(filters, signal),
  })

  if (query.error && !query.isFetching) {
    const msg = query.error instanceof ApiError ? query.error.message : 'Failed to load production runs'
    toast.error(msg)
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: prKeys.all() })
  }, [queryClient])

  const items = query.data?.data ?? []
  const pagination = query.data?.pagination ?? { page: 1, limit: 20, total: 0, hasMore: false }
  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { items, pagination, status, refresh }
}

// ─── useProductionRunDetail ──────────────────────────────────────────────────

export function useProductionRunDetail(id: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: prKeys.detail(id),
    queryFn: ({ signal }) => getProductionRun(id, signal),
    enabled: !!id,
  })

  if (query.error && !query.isFetching) {
    const msg = query.error instanceof ApiError ? query.error.message : 'Failed to load production run'
    toast.error(msg)
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: prKeys.detail(id) })
  }, [queryClient, id])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { run: query.data ?? null, status, refresh }
}
