/**
 * Storefront service — authenticated business operations (Epic C PR4 #121).
 *
 * Tenant-scoped: every operation takes businessId from auth token.
 * Slug validation fires BEFORE any DB write (validateSlug → uniqueness check).
 */

import { prisma } from '../lib/prisma.js'
import { normalizeSlug, validateSlug } from '../lib/storefront-slug.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import type {
  SanitizeStorefrontBusiness,
  SanitizeStorefrontProduct,
} from './sanitize-storefront-public.js'

const BUSINESS_STOREFRONT_SELECT = {
  name: true,
  phone: true,
  storefrontSlug: true,
  storefrontIsPublic: true,
  storefrontTagline: true,
  storefrontTheme: true,
  storefrontWhatsapp: true,
} as const

const STOREFRONT_PRODUCT_SELECT = {
  id: true,
  productId: true,
  priceVisible: true,
  visible: true,
  sortOrder: true,
  product: {
    select: {
      id: true,
      name: true,
      salePrice: true,
      isDeleted: true,
      unit: { select: { symbol: true } },
    },
  },
} as const

export async function getStorefrontSettings(businessId: string) {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: {
      ...BUSINESS_STOREFRONT_SELECT,
      storefrontProducts: {
        select: STOREFRONT_PRODUCT_SELECT,
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  return {
    slug: business.storefrontSlug,
    isPublic: business.storefrontIsPublic,
    tagline: business.storefrontTagline,
    theme: business.storefrontTheme,
    whatsapp: business.storefrontWhatsapp,
    visibleProductCount: business.storefrontProducts.filter((p) => p.visible).length,
  }
}

export interface UpdateStorefrontArgs {
  businessId: string
  slug?: string
  isPublic?: boolean
  tagline?: string | null
  theme?: string
  whatsapp?: string | null
}

export async function updateStorefrontSettings(args: UpdateStorefrontArgs): Promise<void> {
  const data: Record<string, unknown> = {}

  if (args.isPublic !== undefined) data['storefrontIsPublic'] = args.isPublic
  if (args.tagline !== undefined) data['storefrontTagline'] = args.tagline
  if (args.theme !== undefined) data['storefrontTheme'] = args.theme
  if (args.whatsapp !== undefined) data['storefrontWhatsapp'] = args.whatsapp

  // Slug: normalize → validate → uniqueness check
  if (args.slug !== undefined) {
    const normalized = normalizeSlug(args.slug)
    const result = validateSlug(normalized)
    if (!result.ok) {
      const code = result.code === 'RESERVED_SLUG' ? ErrorCode.RESERVED_SLUG : ErrorCode.INVALID_SLUG
      throw new AppError(code, 400, result.code)
    }

    // Uniqueness check: must be either free or owned by this business
    const existing = await prisma.business.findUnique({
      where: { storefrontSlug: normalized },
      select: { id: true },
    })
    if (existing && existing.id !== args.businessId) {
      throw new AppError(ErrorCode.SLUG_TAKEN, 409, 'SLUG_TAKEN')
    }

    data['storefrontSlug'] = normalized
  }

  await prisma.business.update({
    where: { id: args.businessId },
    data,
  })
}

export async function listStorefrontProducts(businessId: string) {
  const rows = await prisma.storefrontProduct.findMany({
    where: { businessId },
    select: STOREFRONT_PRODUCT_SELECT,
    orderBy: { sortOrder: 'asc' },
  })

  return rows
}

export async function addStorefrontProducts(
  businessId: string,
  productIds: string[]
): Promise<{ added: number; skipped: number }> {
  // Validate all productIds belong to this business (tenant-scoped)
  const owned = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      businessId,
      isDeleted: false,
    },
    select: { id: true },
  })

  const ownedIds = new Set(owned.map((p) => p.id))
  const invalid = productIds.filter((id) => !ownedIds.has(id))
  if (invalid.length > 0) {
    throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 404, 'One or more productIds not found or do not belong to this business')
  }

  // Bulk insert — skip duplicates via createMany skipDuplicates
  const result = await prisma.storefrontProduct.createMany({
    data: productIds.map((productId, idx) => ({
      businessId,
      productId,
      sortOrder: idx,
    })),
    skipDuplicates: true,
  })

  return { added: result.count, skipped: productIds.length - result.count }
}

export async function removeStorefrontProduct(
  businessId: string,
  productId: string
): Promise<void> {
  const deleted = await prisma.storefrontProduct.deleteMany({
    where: { businessId, productId },
  })
  if (deleted.count === 0) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'Storefront product not found')
  }
}

export async function updateStorefrontProduct(
  businessId: string,
  productId: string,
  patch: { sortOrder?: number; visible?: boolean; priceVisible?: boolean }
): Promise<void> {
  const result = await prisma.storefrontProduct.updateMany({
    where: { businessId, productId },
    data: {
      ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
      ...(patch.visible !== undefined && { visible: patch.visible }),
      ...(patch.priceVisible !== undefined && { priceVisible: patch.priceVisible }),
    },
  })
  if (result.count === 0) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'Storefront product not found')
  }
}

export interface PublicStorefrontData {
  business: SanitizeStorefrontBusiness
  products: SanitizeStorefrontProduct[]
}

export async function getPublicStorefront(slug: string): Promise<PublicStorefrontData | null> {
  const normalized = normalizeSlug(slug)

  const business = await prisma.business.findFirst({
    where: {
      storefrontSlug: normalized,
      storefrontIsPublic: true,
    },
    select: {
      ...BUSINESS_STOREFRONT_SELECT,
      storefrontProducts: {
        where: { visible: true },
        select: {
          productId: true,
          priceVisible: true,
          product: {
            select: {
              name: true,
              salePrice: true,
              unit: { select: { symbol: true } },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!business) return null

  return {
    business: {
      name: business.name,
      phone: business.phone,
      storefrontTagline: business.storefrontTagline,
      storefrontTheme: business.storefrontTheme,
      storefrontWhatsapp: business.storefrontWhatsapp,
    },
    products: business.storefrontProducts,
  }
}
