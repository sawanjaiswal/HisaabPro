/** Custom Orders API — all calls via api() from @/lib/api */

import { api } from '@/lib/api'
import type { CustomOrderDetail, CustomOrderListResponse } from '../custom-orders.types'
import type {
  CreateCustomOrderInput,
  UpdateCustomOrderInput,
  TransitionCustomOrderInput,
  RecordAdvanceInput,
  ListCustomOrdersQuery,
} from './custom-orders.api.types'

function buildQuery(params: ListCustomOrdersQuery): string {
  const p = new URLSearchParams()
  if (params.status)       p.set('status', params.status)
  if (params.partyId)      p.set('partyId', params.partyId)
  if (params.q)            p.set('q', params.q)
  if (params.deliveryFrom) p.set('deliveryFrom', params.deliveryFrom)
  if (params.deliveryTo)   p.set('deliveryTo', params.deliveryTo)
  if (params.hasBalance !== undefined) p.set('hasBalance', String(params.hasBalance))
  if (params.cursor)       p.set('cursor', params.cursor)
  if (params.limit)        p.set('limit', String(params.limit))
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}

export async function listCustomOrders(query: ListCustomOrdersQuery = {}): Promise<CustomOrderListResponse> {
  return api<CustomOrderListResponse>(`/custom-orders${buildQuery(query)}`)
}

export async function getCustomOrder(id: string): Promise<CustomOrderDetail> {
  return api<CustomOrderDetail>(`/custom-orders/${id}`)
}

export async function createCustomOrder(data: CreateCustomOrderInput): Promise<CustomOrderDetail> {
  return api<CustomOrderDetail>('/custom-orders', {
    method: 'POST',
    body: JSON.stringify(data),
    entityType: 'custom-order',
    entityLabel: data.title,
  })
}

export async function updateCustomOrder(
  id: string,
  data: UpdateCustomOrderInput,
  title: string,
): Promise<CustomOrderDetail> {
  return api<CustomOrderDetail>(`/custom-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    entityType: 'custom-order',
    entityLabel: title,
  })
}

export async function transitionCustomOrder(
  id: string,
  data: TransitionCustomOrderInput,
  title: string,
): Promise<CustomOrderDetail> {
  return api<CustomOrderDetail>(`/custom-orders/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify(data),
    entityType: 'custom-order',
    entityLabel: title,
  })
}

export async function recordAdvance(
  id: string,
  data: RecordAdvanceInput,
  title: string,
): Promise<CustomOrderDetail> {
  return api<CustomOrderDetail>(`/custom-orders/${id}/advances`, {
    method: 'POST',
    body: JSON.stringify(data),
    entityType: 'custom-order',
    entityLabel: title,
  })
}

export async function deleteAdvance(
  orderId: string,
  advanceId: string,
  title: string,
): Promise<CustomOrderDetail> {
  return api<CustomOrderDetail>(`/custom-orders/${orderId}/advances/${advanceId}`, {
    method: 'DELETE',
    entityType: 'custom-order',
    entityLabel: title,
  })
}

export async function convertCustomOrderToInvoice(
  id: string,
  title: string,
): Promise<{ id: string }> {
  return api<{ id: string }>(`/custom-orders/${id}/convert-to-invoice`, {
    method: 'POST',
    body: JSON.stringify({}),
    entityType: 'custom-order',
    entityLabel: title,
  })
}

export async function deleteCustomOrder(id: string, title: string): Promise<void> {
  await api<void>(`/custom-orders/${id}`, {
    method: 'DELETE',
    entityType: 'custom-order',
    entityLabel: title,
  })
}
