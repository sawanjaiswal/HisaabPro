/** Price List feature — TanStack Query keys + hooks */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import {
  listPriceLists,
  getPriceList,
  createPriceList,
  updatePriceList,
  deletePriceList,
  createPriceListEntry,
  updatePriceListEntry,
  deletePriceListEntry,
  bulkAssignParties,
} from './price-list.service'
import type { PriceListFormData, PriceListEntryFormData } from './price-list.types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const priceListKeys = {
  all:    () => ['price-lists'] as const,
  lists:  (page: number) => ['price-lists', 'list', page] as const,
  detail: (id: string) => ['price-lists', 'detail', id] as const,
}

// ─── usePriceLists ────────────────────────────────────────────────────────────

export function usePriceLists(page = 1) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: priceListKeys.lists(page),
    queryFn: ({ signal }) => listPriceLists(page, signal),
  })

  if (query.error && !query.isFetching) {
    const msg = query.error instanceof ApiError ? query.error.message : 'Failed to load price lists'
    toast.error(msg)
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: priceListKeys.all() })
  }, [queryClient])

  const items = query.data?.data ?? []
  const pagination = query.data?.pagination ?? { page: 1, limit: 20, total: 0, hasMore: false }
  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { items, pagination, status, refresh }
}

// ─── usePriceListDetail ───────────────────────────────────────────────────────

export function usePriceListDetail(id: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: priceListKeys.detail(id),
    queryFn: ({ signal }) => getPriceList(id, signal),
    enabled: !!id,
  })

  if (query.error && !query.isFetching) {
    const msg = query.error instanceof ApiError ? query.error.message : 'Failed to load price list'
    toast.error(msg)
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: priceListKeys.detail(id) })
  }, [queryClient, id])

  return { priceList: query.data ?? null, status: query.isPending ? 'loading' as const : query.isError ? 'error' as const : 'success' as const, refresh }
}

// ─── usePriceListMutations ────────────────────────────────────────────────────

export function usePriceListMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: priceListKeys.all() })
  }, [queryClient])

  const create = useMutation({
    mutationFn: (form: PriceListFormData) => createPriceList(form),
    onSuccess: () => { invalidateAll(); toast.success('Price list created') },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to create price list'),
  })

  const update = useMutation({
    mutationFn: ({ id, form }: { id: string; form: PriceListFormData }) => updatePriceList(id, form),
    onSuccess: () => { invalidateAll(); toast.success('Price list updated') },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to update price list'),
  })

  const remove = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => deletePriceList(id, name),
    onSuccess: () => { invalidateAll(); toast.success('Price list deleted') },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to delete price list'),
  })

  return { create, update, remove }
}

// ─── usePriceListEntryMutations ───────────────────────────────────────────────

export function usePriceListEntryMutations(listId: string, listName: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: priceListKeys.detail(listId) })
  }, [queryClient, listId])

  const create = useMutation({
    mutationFn: (form: PriceListEntryFormData) => createPriceListEntry(listId, listName, form),
    onSuccess: () => { invalidate(); toast.success('Entry added') },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to add entry'),
  })

  const update = useMutation({
    mutationFn: ({ entryId, form }: { entryId: string; form: PriceListEntryFormData }) =>
      updatePriceListEntry(listId, entryId, listName, form),
    onSuccess: () => { invalidate(); toast.success('Entry updated') },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to update entry'),
  })

  const remove = useMutation({
    mutationFn: ({ entryId, productName }: { entryId: string; productName: string }) =>
      deletePriceListEntry(listId, entryId, listName, productName),
    onSuccess: () => { invalidate(); toast.success('Entry deleted') },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to delete entry'),
  })

  return { create, update, remove }
}

// ─── useBulkAssignParties ─────────────────────────────────────────────────────

export function useBulkAssignParties(listId: string, listName: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (partyIds: string[]) => bulkAssignParties(listId, listName, partyIds),
    onSuccess: (result) => {
      const base = `Assigned ${result.assigned} ${result.assigned === 1 ? 'party' : 'parties'} to ${listName}`
      const overlapNote = result.partyPricingOverlapCount > 0
        ? ` (${result.partyPricingOverlapCount} had per-product overrides that still win)`
        : ''
      toast.success(base + overlapNote)
      queryClient.invalidateQueries({ queryKey: priceListKeys.all() })
      queryClient.invalidateQueries({ queryKey: priceListKeys.detail(listId) })
      queryClient.invalidateQueries({ queryKey: ['parties'] })
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : 'Failed to assign parties'),
  })
}
