/**
 * Coupon Admin -- Hook (TanStack Query)
 * Feature #96
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useDebounce } from '@/hooks/useDebounce'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import * as couponService from './coupon.service'
import type { Coupon, CouponListResult, CouponStatus, CreateCouponInput, BulkCreateInput } from './coupon.types'

type Status = 'loading' | 'error' | 'success'

interface UseCouponsReturn {
  coupons: Coupon[]
  total: number
  nextCursor: string | null
  status: Status
  statusFilter: CouponStatus | undefined
  searchQuery: string
  refresh: () => void
  setStatusFilter: (status: CouponStatus | undefined) => void
  setSearchQuery: (query: string) => void
  loadMore: () => void
  handleCreate: (data: CreateCouponInput) => Promise<Coupon | null>
  handleBulkCreate: (data: BulkCreateInput) => Promise<boolean>
  handleDeactivate: (couponId: string, code: string) => Promise<boolean>
}

export function useCoupons(): UseCouponsReturn {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<CouponStatus | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery)

  // Track merged data for load-more pagination
  const isLoadMore = useRef(false)
  const [mergedCoupons, setMergedCoupons] = useState<Coupon[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const filters = { status: statusFilter, search: debouncedSearch || undefined } as Record<string, unknown>

  const query = useQuery({
    queryKey: queryKeys.coupons.list(filters),
    queryFn: ({ signal }) =>
      couponService.listCoupons(
        { status: statusFilter, search: debouncedSearch || undefined },
        signal,
      ),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (!query.data) return
    const result = query.data as CouponListResult
    if (!isLoadMore.current) {
      setMergedCoupons(result.items)
    } else {
      setMergedCoupons((prev) => [...prev, ...result.items])
    }
    setTotal(result.total)
    setNextCursor(result.nextCursor)
    isLoadMore.current = false
  }, [query.data])

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load coupons')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    isLoadMore.current = false
    setMergedCoupons([])
    queryClient.invalidateQueries({ queryKey: queryKeys.coupons.all() })
  }, [queryClient])

  const loadMoreMutation = useMutation({
    mutationFn: () =>
      couponService.listCoupons({
        cursor: nextCursor ?? undefined,
        status: statusFilter,
        search: searchQuery || undefined,
      }),
    onSuccess: (result: CouponListResult) => {
      setMergedCoupons((prev) => [...prev, ...result.items])
      setNextCursor(result.nextCursor)
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load more')
    },
  })

  const loadMore = useCallback(() => {
    if (!nextCursor) return
    loadMoreMutation.mutate()
  }, [nextCursor, loadMoreMutation])

  const createMutation = useMutation({
    mutationFn: (data: CreateCouponInput) => couponService.createCoupon(data),
    onSuccess: (coupon) => {
      toast.success(`Coupon ${coupon.code} created`)
      refresh()
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create coupon')
    },
  })

  const bulkCreateMutation = useMutation({
    mutationFn: (data: BulkCreateInput) => couponService.bulkCreateCoupons(data),
    onSuccess: (result) => {
      toast.success(`${result.created} coupons generated`)
      refresh()
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to generate coupons')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: ({ couponId }: { couponId: string; code: string }) =>
      couponService.deactivateCoupon(couponId),
    onSuccess: (_data, { code }) => {
      toast.success(`Coupon ${code} deactivated`)
      refresh()
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to deactivate')
    },
  })

  const handleCreate = useCallback(
    async (data: CreateCouponInput): Promise<Coupon | null> => {
      try {
        return await createMutation.mutateAsync(data)
      } catch {
        return null
      }
    },
    [createMutation],
  )

  const handleBulkCreate = useCallback(
    async (data: BulkCreateInput): Promise<boolean> => {
      try {
        await bulkCreateMutation.mutateAsync(data)
        return true
      } catch {
        return false
      }
    },
    [bulkCreateMutation],
  )

  const handleDeactivate = useCallback(
    async (couponId: string, code: string): Promise<boolean> => {
      try {
        await deactivateMutation.mutateAsync({ couponId, code })
        return true
      } catch {
        return false
      }
    },
    [deactivateMutation],
  )

  return {
    coupons: mergedCoupons,
    total,
    nextCursor,
    status,
    statusFilter,
    searchQuery,
    refresh,
    setStatusFilter,
    setSearchQuery,
    loadMore,
    handleCreate,
    handleBulkCreate,
    handleDeactivate,
  }
}
