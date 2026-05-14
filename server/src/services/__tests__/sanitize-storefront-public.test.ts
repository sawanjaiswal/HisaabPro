/**
 * Fuzz test — sanitizeStorefrontForPublic
 *
 * Verifies that every field NOT in the explicit allowlist is absent from
 * the public DTO.  Adding a new sensitive field to Business / Product
 * without updating the sanitizer will fail this test.
 *
 * ARCHITECTURE §8.2 / Security E1.
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeStorefrontForPublic,
  type SanitizeStorefrontBusiness,
  type SanitizeStorefrontProduct,
} from '../sanitize-storefront-public.js'

// ---------------------------------------------------------------------------
// Hostile business fixture — every field that must NOT appear in public DTO
// ---------------------------------------------------------------------------

const hostileBusiness: SanitizeStorefrontBusiness & Record<string, unknown> = {
  // allowlisted
  name: 'Raju Traders',
  phone: '+919876543210',
  storefrontTagline: 'Fresh daily',
  storefrontTheme: 'LIGHT',
  storefrontWhatsapp: '919876543210',

  // MUST be stripped (add hostile fields here to test the blocklist)
  email: 'raju@secret.com',
  gstin: '27AABCU9603R1ZM',
  udyamNumber: 'UDYAM-MH-12-0012345',
  ownerName: 'Raju Kumar',
  address: '123 Main Street',
  addressLine1: '123 Main Street',
  addressLine2: 'Andheri',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400058',
  bankDetails: JSON.stringify({ accountNo: '123456789', ifsc: 'HDFC0001234' }),
  secretToken: 'super-secret-api-key',
  apiKey: 'sk-live-abcdef',
  subscriptionTier: 'PRO',
  internalId: 'internal-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true,
  currencyCode: 'INR',
  businessType: 'retail',
}

// ---------------------------------------------------------------------------
// Hostile product fixture
// ---------------------------------------------------------------------------

const hostileProduct: SanitizeStorefrontProduct & Record<string, unknown> = {
  productId: 'prod-001',
  priceVisible: true,
  product: {
    name: 'Milk 500ml',
    salePrice: 3000, // paise
    unit: { symbol: 'ltr' },

    // hostile nested fields — these don't reach through the typed interface
    // but we test the nested product object too
  } as SanitizeStorefrontProduct['product'] & Record<string, unknown>,

  // hostile top-level fields on the join row
  businessId: 'biz-001',
  sortOrder: 0,
  visible: true,
  createdAt: new Date(),
}

const hostileProductWithSecrets: SanitizeStorefrontProduct = {
  productId: 'prod-002',
  priceVisible: false,
  // Cast to unknown first to inject hostile fields at runtime (type-safe bypass)
  product: ({
    name: 'Sugar 1kg',
    salePrice: 5000,
    unit: null,
    costPrice: 2000,
    weightedAvgCostPaise: 2000,
    stock: 100,
    currentStock: 100,
    reorderQty: 10,
    supplierName: 'ABC Suppliers',
    internalSku: 'SUGAR-001',
    hsn: '1701',
    hsnCode: '1701',
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sku: 'SUGAR-001',
    barcode: '8901234567890',
    description: 'Fine white sugar',
    purchasePrice: 4000,
  } as unknown) as SanitizeStorefrontProduct['product'],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sanitizeStorefrontForPublic', () => {
  it('returns only allowlisted business fields', () => {
    const dto = sanitizeStorefrontForPublic(hostileBusiness, [])

    // Allowlisted
    expect(dto.businessName).toBe('Raju Traders')
    expect(dto.tagline).toBe('Fresh daily')
    expect(dto.theme).toBe('LIGHT')
    expect(dto.whatsappNumber).toBe('919876543210')

    // Stripped — must NOT appear anywhere in the output object
    const dtoStr = JSON.stringify(dto)
    expect(dtoStr).not.toContain('raju@secret.com')
    expect(dtoStr).not.toContain('27AABCU9603R1ZM')
    expect(dtoStr).not.toContain('UDYAM-MH-12-0012345')
    expect(dtoStr).not.toContain('Raju Kumar')
    expect(dtoStr).not.toContain('123 Main Street')
    expect(dtoStr).not.toContain('123456789')
    expect(dtoStr).not.toContain('super-secret-api-key')
    expect(dtoStr).not.toContain('sk-live-abcdef')
    expect(dtoStr).not.toContain('subscriptionTier')
    expect(dtoStr).not.toContain('internalId')
  })

  it('returns only allowlisted product fields', () => {
    const dto = sanitizeStorefrontForPublic(hostileBusiness, [hostileProduct])

    expect(dto.products).toHaveLength(1)
    const p = dto.products[0]

    // Allowlisted
    expect(p.id).toBe('prod-001')
    expect(p.name).toBe('Milk 500ml')
    expect(p.unit).toBe('ltr')
    expect(p.price).toBe(3000) // priceVisible=true

    // Stripped
    const pStr = JSON.stringify(p)
    expect(pStr).not.toContain('businessId')
    expect(pStr).not.toContain('sortOrder')
    expect(pStr).not.toContain('createdAt')
  })

  it('sets price to null when priceVisible=false', () => {
    const dto = sanitizeStorefrontForPublic(hostileBusiness, [hostileProductWithSecrets])
    expect(dto.products[0].price).toBeNull()
  })

  it('strips costPrice and other sensitive product fields', () => {
    const dto = sanitizeStorefrontForPublic(hostileBusiness, [hostileProductWithSecrets])
    const dtoStr = JSON.stringify(dto)
    expect(dtoStr).not.toContain('costPrice')
    expect(dtoStr).not.toContain('2000') // costPrice value
    expect(dtoStr).not.toContain('supplierName')
    expect(dtoStr).not.toContain('ABC Suppliers')
    expect(dtoStr).not.toContain('internalSku')
    expect(dtoStr).not.toContain('SUGAR-001')
    expect(dtoStr).not.toContain('hsnCode')
    expect(dtoStr).not.toContain('purchasePrice')
    expect(dtoStr).not.toContain('weightedAvg')
  })

  it('falls back to business.phone when storefrontWhatsapp is null', () => {
    const biz = { ...hostileBusiness, storefrontWhatsapp: null, phone: '9999999999' }
    const dto = sanitizeStorefrontForPublic(biz, [])
    expect(dto.whatsappNumber).toBe('9999999999')
  })

  it('returns null whatsapp when both storefrontWhatsapp and phone are null', () => {
    const biz = { ...hostileBusiness, storefrontWhatsapp: null, phone: null }
    const dto = sanitizeStorefrontForPublic(biz, [])
    expect(dto.whatsappNumber).toBeNull()
  })

  it('defaults theme to LIGHT for unknown values', () => {
    const biz = { ...hostileBusiness, storefrontTheme: 'CUSTOM' }
    const dto = sanitizeStorefrontForPublic(biz, [])
    expect(dto.theme).toBe('LIGHT')
  })

  it('returns DARK theme correctly', () => {
    const biz = { ...hostileBusiness, storefrontTheme: 'DARK' }
    const dto = sanitizeStorefrontForPublic(biz, [])
    expect(dto.theme).toBe('DARK')
  })

  it('returns empty products array when no rows', () => {
    const dto = sanitizeStorefrontForPublic(hostileBusiness, [])
    expect(dto.products).toEqual([])
  })

  it('returns null unit when product has no unit', () => {
    const row: SanitizeStorefrontProduct = {
      productId: 'prod-003',
      priceVisible: true,
      product: { name: 'Bulk Item', salePrice: 1000, unit: null },
    }
    const dto = sanitizeStorefrontForPublic(hostileBusiness, [row])
    expect(dto.products[0].unit).toBeNull()
  })

  it('top-level DTO has exactly the expected keys', () => {
    const dto = sanitizeStorefrontForPublic(hostileBusiness, [])
    const keys = Object.keys(dto).sort()
    expect(keys).toEqual(['businessName', 'products', 'tagline', 'theme', 'whatsappNumber'])
  })

  it('product DTO has exactly the expected keys', () => {
    const dto = sanitizeStorefrontForPublic(hostileBusiness, [hostileProduct])
    const pKeys = Object.keys(dto.products[0]).sort()
    expect(pKeys).toEqual(['id', 'name', 'price', 'unit'])
  })
})
