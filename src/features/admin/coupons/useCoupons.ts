/**
 * Coupon Admin — Hook (state + API)
 * Feature #96
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { useDebounce } from '@/hooks/useDebounce'
import { ApiError } from '@/lib/api'
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
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [statusFilter, setStatusFilter] = useState<CouponStatus | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    couponService
      .listCoupons({ status: statusFilter, search: debouncedSearch || undefined }, controller.signal)
      .then((result: CouponListResult) => {
        setCoupons(result.items)
        setTotal(result.total)
        setNextCursor(result.nextCursor)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load coupons'
        toast.error(message)
      })

    return () => controller.abort()
  }, [statusFilter, debouncedSearch, refreshKey, toast])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const loadMore = useCallback(() => {
    if (!nextCursor) return

    couponService
      .listCoupons({ cursor: nextCursor, status: statusFilter, search: searchQuery || undefined })
      .then((result: CouponListResult) => {
        setCoupons((prev) => [...prev, ...result.items])
        setNextCursor(result.nextCursor)
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to load more'
        toast.error(message)
      })
  }, [nextCursor, statusFilter, searchQuery, toast])

  const handleCreate = useCallback(
    async (data: CreateCouponInput): Promise<Coupon | null> => {
      try {
        const coupon = await couponService.createCoupon(data)
        toast.success(`Coupon ${coupon.code} created`)
        refresh()
        return coupon
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to create coupon'
        toast.error(message)
        return null
      }
    },
    [toast, refresh]
  )

  const handleBulkCreate = useCallback(
    async (data: BulkCreateInput): Promise<boolean> => {
      try {
        const result = await couponService.bulkCreateCoupons(data)
        toast.success(`${result.created} coupons generated`)
        refresh()
        return true
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to generate coupons'
        toast.error(message)
        return false
      }
    },
    [toast, refresh]
  )

  const handleDeactivate = useCallback(
    async (couponId: string, code: string): Promise<boolean> => {
      try {
        await couponService.deactivateCoupon(couponId)
        toast.success(`Coupon ${code} deactivated`)
        refresh()
        return true
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to deactivate'
        toast.error(message)
        return false
      }
    },
    [toast, refresh]
  )

  return {
    coupons,
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
