/**
 * Coupon — API service layer (admin endpoints)
 * Feature #96
 *
 * Admin routes use Bearer token auth (separate from user cookie auth).
 * TODO: Wire into admin auth context when admin frontend is built.
 */

import { api } from '@/lib/api'
import type {
  Coupon,
  CouponDetail,
  CouponListResult,
  BulkCreateResult,
  CreateCouponInput,
  UpdateCouponInput,
  BulkCreateInput,
} from './coupon.types'

// ─── Admin CRUD ──────────────────────────────────────────────────────────

export async function createCoupon(
  data: CreateCouponInput,
  signal?: AbortSignal
): Promise<Coupon> {
  return api<Coupon>('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

export async function bulkCreateCoupons(
  data: BulkCreateInput,
  signal?: AbortSignal
): Promise<BulkCreateResult> {
  return api<BulkCreateResult>('/admin/coupons/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

export async function listCoupons(
  params: { cursor?: string; limit?: number; status?: string; search?: string } = {},
  signal?: AbortSignal
): Promise<CouponListResult> {
  const qs = new URLSearchParams()
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.status) qs.set('status', params.status)
  if (params.search) qs.set('search', params.search)
  const query = qs.toString()
  return api<CouponListResult>(`/admin/coupons${query ? `?${query}` : ''}`, { signal })
}

export async function getCouponDetail(
  couponId: string,
  signal?: AbortSignal
): Promise<CouponDetail> {
  return api<CouponDetail>(`/admin/coupons/${couponId}`, { signal })
}

export async function updateCoupon(
  couponId: string,
  data: UpdateCouponInput,
  signal?: AbortSignal
): Promise<Coupon> {
  return api<Coupon>(`/admin/coupons/${couponId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    signal,
  })
}

export async function deactivateCoupon(
  couponId: string,
  signal?: AbortSignal
): Promise<{ deactivated: boolean }> {
  return api<{ deactivated: boolean }>(`/admin/coupons/${couponId}`, {
    method: 'DELETE',
    signal,
  })
}

