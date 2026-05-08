/** BOM hooks — list + detail (TanStack Query) */

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { listBoms, getBom } from '../bom.service'
import type { BomListFilters } from '../bom.types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const bomKeys = {
  all: () => ['bom'] as const,
  list: (f: BomListFilters) => ['bom', 'list', f] as const,
  detail: (id: string) => ['bom', 'detail', id] as const,
}

// ─── useBomList ───────────────────────────────────────────────────────────────

export function useBomList(filters: BomListFilters) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: bomKeys.list(filters),
    queryFn: ({ signal }) => listBoms(filters, signal),
  })

  if (query.error && !query.isFetching) {
    const msg =
      query.error instanceof ApiError ? query.error.message : 'Failed to load recipes'
    toast.error(msg)
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: bomKeys.all() })
  }, [queryClient])

  const items = query.data?.data ?? []
  const pagination = query.data?.pagination ?? { page: 1, limit: 20, total: 0, hasMore: false }
  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { items, pagination, status, refresh }
}

// ─── useBomDetail ─────────────────────────────────────────────────────────────

export function useBomDetail(id: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: bomKeys.detail(id),
    queryFn: ({ signal }) => getBom(id, signal),
    enabled: !!id,
  })

  if (query.error && !query.isFetching) {
    const msg =
      query.error instanceof ApiError ? query.error.message : 'Failed to load recipe'
    toast.error(msg)
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: bomKeys.detail(id) })
  }, [queryClient, id])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { bom: query.data ?? null, status, refresh }
}
