/** Price List feature — API service layer (all calls via api()) */

import { api } from '@/lib/api'
import { PRICE_LIST_PAGE_LIMIT } from './price-list.constants'
import type {
  PriceListsResponse,
  PriceListResponse,
  PriceListEntryResponse,
  PriceListFormData,
  PriceListEntryFormData,
  PriceListDetail,
} from './price-list.types'
import { percentToBps } from './price-list.constants'

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listPriceLists(
  page = 1,
  signal?: AbortSignal,
): Promise<PriceListsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(PRICE_LIST_PAGE_LIMIT) })
  return api<PriceListsResponse>(`/price-lists?${params}`, { signal, cacheReads: true })
}

// ─── Get detail ───────────────────────────────────────────────────────────────

export async function getPriceList(id: string, signal?: AbortSignal): Promise<PriceListDetail> {
  const res = await api<PriceListResponse>(`/price-lists/${id}`, { signal, cacheReads: true })
  return res.data
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createPriceList(form: PriceListFormData): Promise<PriceListDetail> {
  const res = await api<PriceListResponse>('/price-lists', {
    method: 'POST',
    body: JSON.stringify({ name: form.name.trim(), isDefault: form.isDefault }),
    entityType: 'priceList',
    entityLabel: form.name.trim(),
  })
  return res.data
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updatePriceList(
  id: string,
  form: PriceListFormData,
): Promise<PriceListDetail> {
  const res = await api<PriceListResponse>(`/price-lists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: form.name.trim(), isDefault: form.isDefault }),
    entityType: 'priceList',
    entityLabel: form.name.trim(),
  })
  return res.data
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deletePriceList(id: string, name: string): Promise<void> {
  await api(`/price-lists/${id}`, {
    method: 'DELETE',
    entityType: 'priceList',
    entityLabel: name,
  })
}

// ─── Entry create ─────────────────────────────────────────────────────────────

export async function createPriceListEntry(
  listId: string,
  listName: string,
  form: PriceListEntryFormData,
) {
  const body = buildEntryBody(form)
  const res = await api<PriceListEntryResponse>(`/price-lists/${listId}/entries`, {
    method: 'POST',
    body: JSON.stringify(body),
    entityType: 'priceListEntry',
    entityLabel: `${listName} entry for ${form.productName}`,
  })
  return res.data
}

// ─── Entry update ─────────────────────────────────────────────────────────────

export async function updatePriceListEntry(
  listId: string,
  entryId: string,
  listName: string,
  form: PriceListEntryFormData,
) {
  const body = buildEntryBody(form)
  const res = await api<PriceListEntryResponse>(`/price-lists/${listId}/entries/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    entityType: 'priceListEntry',
    entityLabel: `${listName} entry for ${form.productName}`,
  })
  return res.data
}

// ─── Entry delete ─────────────────────────────────────────────────────────────

export async function deletePriceListEntry(
  listId: string,
  entryId: string,
  listName: string,
  productName: string,
): Promise<void> {
  await api(`/price-lists/${listId}/entries/${entryId}`, {
    method: 'DELETE',
    entityType: 'priceListEntry',
    entityLabel: `${listName} entry for ${productName}`,
  })
}

// ─── Bulk assign parties ──────────────────────────────────────────────────────

export interface BulkAssignResponse {
  assigned: number
  partyPricingOverlapCount: number
}

export async function bulkAssignParties(
  listId: string,
  listName: string,
  partyIds: string[],
): Promise<BulkAssignResponse> {
  return api<BulkAssignResponse>(`/price-lists/${listId}/bulk-assign-parties`, {
    method: 'POST',
    body: JSON.stringify({ partyIds }),
    entityType: 'priceListAssign',
    entityLabel: listName,
  })
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function buildEntryBody(form: PriceListEntryFormData) {
  const minQty = parseInt(form.minQty || '1', 10)
  const maxQtyRaw = form.maxQty.trim()
  const maxQty = maxQtyRaw === '' ? null : parseInt(maxQtyRaw, 10)

  return {
    productId: form.productId,
    mode: form.mode,
    valuePaise: form.mode === 'ABSOLUTE' ? Math.round(parseFloat(form.value || '0') * 100) : null,
    percentBps: form.mode === 'PERCENT_OFF' ? percentToBps(form.value) : null,
    fixedOffPaise: form.mode === 'FIXED_OFF' ? Math.round(parseFloat(form.value || '0') * 100) : null,
    minQty,
    maxQty,
  }
}
