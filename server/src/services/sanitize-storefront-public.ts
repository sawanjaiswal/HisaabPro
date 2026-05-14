/**
 * Public storefront sanitizer — Epic C PR4 (#121).
 *
 * Security E1 (SECURITY_AUDIT_EPIC_C.md): positive-allowlist Pick.
 * NEVER spread a Prisma model. Every new field added to Business / Product
 * is invisible until explicitly added to this allowlist.
 *
 * Fuzz test: src/services/__tests__/sanitize-storefront-public.test.ts
 */

// ---------------------------------------------------------------------------
// Public DTO — the ONLY shape that leaves the server on GET /api/p/store/:slug
// ---------------------------------------------------------------------------

export type PublicStorefrontProductDto = {
  id: string
  name: string
  unit: string | null
  price: number | null  // null when priceVisible=false; paise
}

export type PublicStorefrontDto = {
  businessName: string
  tagline: string | null
  whatsappNumber: string | null  // E.164 digits (no +); falls back to business.phone
  theme: 'LIGHT' | 'DARK'
  products: PublicStorefrontProductDto[]
}

// ---------------------------------------------------------------------------
// Input shapes (what we fetch from Prisma — explicit select, not full model)
// ---------------------------------------------------------------------------

export interface SanitizeStorefrontBusiness {
  name: string
  phone: string | null
  storefrontTagline: string | null
  storefrontTheme: string
  storefrontWhatsapp: string | null
}

export interface SanitizeStorefrontProduct {
  productId: string
  priceVisible: boolean
  product: {
    name: string
    salePrice: number
    unit: { symbol: string } | null
  }
}

// ---------------------------------------------------------------------------
// Sanitizer — hand-written field-by-field, no spread
// ---------------------------------------------------------------------------

export function sanitizeStorefrontForPublic(
  business: SanitizeStorefrontBusiness,
  rows: SanitizeStorefrontProduct[]
): PublicStorefrontDto {
  return {
    businessName: business.name,
    tagline: business.storefrontTagline ?? null,
    whatsappNumber: business.storefrontWhatsapp ?? business.phone ?? null,
    theme: business.storefrontTheme === 'DARK' ? 'DARK' : 'LIGHT',
    products: rows.map((r): PublicStorefrontProductDto => ({
      id: r.productId,
      name: r.product.name,
      unit: r.product.unit?.symbol ?? null,
      price: r.priceVisible ? r.product.salePrice : null,
    })),
  }
}
