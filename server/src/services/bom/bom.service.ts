/**
 * BOM read + create service — list, get, create.
 * Update and delete live in bom-write.service.ts.
 */

import { prisma } from '../../lib/prisma.js'
import { validateBomComponents } from './bom.validators.js'
import type {
  BomDetailDTO,
  BomSummaryDTO,
  BomListResult,
  BomComponentDTO,
} from './bom.types.js'
import type { CreateBomInput, ListBomQuery } from '../../schemas/bom/bom.schemas.js'

// ─── Shared helpers (also used by bom-write.service.ts) ──────────────────────

export function mapBomComponent(c: {
  id: string
  componentProductId: string
  componentProduct: { name: string; currentStock: number }
  quantity: number
  unitId: string | null
  unit: { name: string } | null
  notes: string | null
}): BomComponentDTO {
  return {
    id: c.id,
    componentProductId: c.componentProductId,
    componentProductName: c.componentProduct.name,
    quantity: c.quantity,
    unitId: c.unitId,
    unitName: c.unit?.name ?? null,
    notes: c.notes,
    currentStock: c.componentProduct.currentStock,
  }
}

export async function loadBomDetail(bomId: string, businessId: string): Promise<BomDetailDTO | null> {
  const bom = await prisma.bom.findFirst({
    where: { id: bomId, businessId, isDeleted: false },
    include: {
      product: { select: { name: true } },
      components: {
        include: {
          componentProduct: { select: { name: true, currentStock: true } },
          unit: { select: { name: true } },
        },
      },
      _count: { select: { productionRuns: true } },
    },
  })
  if (!bom) return null
  return {
    id: bom.id,
    productId: bom.productId,
    productName: bom.product.name,
    name: bom.name,
    version: bom.version,
    isActive: bom.isActive,
    isDefault: bom.isDefault,
    notes: bom.notes,
    components: bom.components.map(mapBomComponent),
    productionRunCount: bom._count.productionRuns,
    createdAt: bom.createdAt.toISOString(),
    updatedAt: bom.updatedAt.toISOString(),
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listBoms(
  businessId: string,
  query: ListBomQuery
): Promise<BomListResult> {
  const { productId, isActive, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    isDeleted: false,
    ...(productId ? { productId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  }

  const [total, boms] = await Promise.all([
    prisma.bom.count({ where }),
    prisma.bom.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true } },
        _count: { select: { components: true } },
      },
    }),
  ])

  const data: BomSummaryDTO[] = boms.map(b => ({
    id: b.id,
    productId: b.productId,
    productName: b.product.name,
    name: b.name,
    version: b.version,
    isActive: b.isActive,
    isDefault: b.isDefault,
    componentCount: b._count.components,
    createdAt: b.createdAt.toISOString(),
  }))

  return { data, pagination: { page, limit, total, hasMore: skip + limit < total } }
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getBom(bomId: string, businessId: string): Promise<BomDetailDTO> {
  const detail = await loadBomDetail(bomId, businessId)
  if (!detail) throw { code: 'BOM_NOT_FOUND', message: 'BOM not found', status: 404 }
  return detail
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createBom(
  businessId: string,
  userId: string,
  input: CreateBomInput
): Promise<BomDetailDTO> {
  await validateBomComponents({
    businessId,
    finishedProductId: input.productId,
    components: input.components,
  })

  if (input.isDefault) {
    await prisma.bom.updateMany({
      where: { businessId, productId: input.productId, isDefault: true, isDeleted: false },
      data: { isDefault: false },
    })
  }

  const bom = await prisma.bom.create({
    data: {
      businessId,
      productId: input.productId,
      name: input.name,
      isDefault: input.isDefault ?? false,
      notes: input.notes ?? null,
      createdBy: userId,
      components: {
        create: input.components.map(c => ({
          componentProductId: c.componentProductId,
          quantity: c.quantity,
          unitId: c.unitId ?? null,
          notes: c.notes ?? null,
        })),
      },
    },
  })

  return (await loadBomDetail(bom.id, businessId))!
}
