// ─── Storefront Types (Epic C PR4 — #121) ────────────────────────────────────

export type StorefrontTheme = 'cream' | 'dark' | 'blue' | 'green'

export interface StorefrontSettings {
  slug: string | null
  isPublic: boolean
  tagline: string | null
  whatsapp: string | null
  theme: StorefrontTheme
  visibleProductCount: number
}

export type PatchSettingsPayload = Partial<Omit<StorefrontSettings, 'visibleProductCount'>>

export interface StorefrontProduct {
  id: string
  productId: string
  name: string
  sellingPrice: number
  imageUrl: string | null
  sortOrder: number
  visible: boolean
}

export interface StorefrontProductsResponse {
  data: StorefrontProduct[]
}

export interface AddProductsPayload {
  productIds: string[]
}

export interface PatchProductPayload {
  sortOrder?: number
  visible?: boolean
}

// Public store DTO
export interface PublicStoreBusiness {
  name: string
  logoUrl: string | null
  upiVpa: string | null
}

export interface PublicStoreProduct {
  id: string
  name: string
  sellingPrice: number
  imageUrl: string | null
}

export interface PublicStorefrontDto {
  slug: string
  tagline: string | null
  whatsapp: string | null
  theme: StorefrontTheme
  business: PublicStoreBusiness
  products: PublicStoreProduct[]
}

export type SlugError = 'INVALID_SLUG' | 'RESERVED_SLUG' | 'SLUG_TAKEN' | null

export type SettingsStatus = 'loading' | 'error' | 'empty' | 'success'
export type ProductsStatus = 'loading' | 'error' | 'empty' | 'success'
export type PublicStoreStatus = 'loading' | 'not-found' | 'empty' | 'error' | 'success'
