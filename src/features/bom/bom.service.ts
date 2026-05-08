/** BOM feature — API service layer */

import { api } from '@/lib/api'
import { BOM_PAGE_LIMIT } from './bom.constants'
import { formRowsToComponents } from './bom.utils'
import type { BomListResponse, BomDetailDTO, BomDetailResponse, BomListFilters, BomFormData } from './bom.types'

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listBoms(
  filters: BomListFilters,
  signal?: AbortSignal,
): Promise<BomListResponse> {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(BOM_PAGE_LIMIT),
  })
  if (filters.productId) params.set('productId', filters.productId)
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive))
  return api<BomListResponse>(`/bom?${params}`, { signal, cacheReads: true })
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getBom(id: string, signal?: AbortSignal): Promise<BomDetailDTO> {
  const res = await api<BomDetailResponse>(`/bom/${id}`, { signal, cacheReads: true })
  return res.data
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createBom(form: BomFormData, signal?: AbortSignal): Promise<BomDetailDTO> {
  const res = await api<BomDetailResponse>('/bom', {
    method: 'POST',
    body: JSON.stringify({
      productId: form.productId,
      name: form.name.trim(),
      isDefault: form.isDefault,
      notes: form.notes || undefined,
      components: formRowsToComponents(form.components),
    }),
    signal,
    entityType: 'bom',
    entityLabel: form.name.trim(),
  })
  return res.data
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateBom(
  id: string,
  form: BomFormData,
  signal?: AbortSignal,
): Promise<{ data: BomDetailDTO; versioned: boolean }> {
  const res = await api<BomDetailResponse & { versioned: boolean }>(`/bom/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      productId: form.productId,
      name: form.name.trim(),
      isDefault: form.isDefault,
      isActive: form.isActive,
      notes: form.notes || undefined,
      components: formRowsToComponents(form.components),
    }),
    signal,
    entityType: 'bom',
    entityLabel: form.name.trim(),
  })
  return { data: res.data, versioned: res.versioned ?? false }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteBom(id: string, name: string, signal?: AbortSignal): Promise<void> {
  await api(`/bom/${id}`, {
    method: 'DELETE',
    signal,
    entityType: 'bom',
    entityLabel: name,
  })
}
