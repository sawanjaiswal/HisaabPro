// ─── Storefront Service (Epic C PR4 — #121) ──────────────────────────────────

import { api } from '@/lib/api'
import type {
  StorefrontSettings,
  PatchSettingsPayload,
  StorefrontProductsResponse,
  AddProductsPayload,
  PatchProductPayload,
  PublicStorefrontDto,
} from './storefront.types'

const BASE = '/businesses/me/storefront'

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getStorefrontSettings(
  signal?: AbortSignal,
): Promise<StorefrontSettings> {
  return api<StorefrontSettings>(BASE, { signal })
}

export async function patchStorefrontSettings(
  payload: PatchSettingsPayload,
): Promise<StorefrontSettings> {
  return api<StorefrontSettings>(BASE, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    entityType: 'storefront',
    entityLabel: payload.slug ?? 'storefront',
  })
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getStorefrontProducts(
  signal?: AbortSignal,
): Promise<StorefrontProductsResponse> {
  return api<StorefrontProductsResponse>(`${BASE}/products`, { signal })
}

export async function addStorefrontProducts(
  payload: AddProductsPayload,
): Promise<StorefrontProductsResponse> {
  return api<StorefrontProductsResponse>(`${BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    entityType: 'storefrontProduct',
    entityLabel: `${payload.productIds.length} product(s)`,
  })
}

export async function deleteStorefrontProduct(
  productId: string,
  name: string,
): Promise<void> {
  return api<void>(`${BASE}/products/${productId}`, {
    method: 'DELETE',
    entityType: 'storefrontProduct',
    entityLabel: name,
  })
}

export async function patchStorefrontProduct(
  productId: string,
  name: string,
  payload: PatchProductPayload,
): Promise<void> {
  return api<void>(`${BASE}/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    entityType: 'storefrontProduct',
    entityLabel: name,
  })
}

// ─── Public surface (no auth) ─────────────────────────────────────────────────

export async function getPublicStorefront(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicStorefrontDto> {
  return api<PublicStorefrontDto>(`/p/store/${slug}`, { signal })
}
