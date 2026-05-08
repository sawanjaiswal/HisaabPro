/**
 * BOM write service — update (with version-bump) + soft-delete.
 * Split from bom.service.ts to stay under 250-line limit.
 */

import { prisma } from '../../lib/prisma.js'
import { validateBomComponents } from './bom.validators.js'
import { loadBomDetail } from './bom.service.js'
import type { BomDetailDTO } from './bom.types.js'
import type { UpdateBomInput } from '../../schemas/bom/bom.schemas.js'

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateBom(
  bomId: string,
  businessId: string,
  userId: string,
  input: UpdateBomInput
): Promise<BomDetailDTO & { versioned: boolean }> {
  const existing = await prisma.bom.findFirst({
    where: { id: bomId, businessId, isDeleted: false },
    include: { _count: { select: { productionRuns: true } } },
  })
  if (!existing) throw { code: 'BOM_NOT_FOUND', message: 'BOM not found', status: 404 }

  const finishedProductId = input.productId ?? existing.productId
  if (input.components) {
    await validateBomComponents({ businessId, finishedProductId, components: input.components })
  }

  const hasRuns = existing._count.productionRuns > 0

  if (hasRuns) {
    return versionBump({ bomId, businessId, userId, input, existing, finishedProductId })
  }

  return inPlaceUpdate({ bomId, businessId, userId, input, existing, finishedProductId })
}

// ─── Version bump (BOM has runs → create new version) ────────────────────────

async function versionBump(args: {
  bomId: string
  businessId: string
  userId: string
  input: UpdateBomInput
  existing: { version: number; name: string; notes: string | null; isDefault: boolean }
  finishedProductId: string
}): Promise<BomDetailDTO & { versioned: boolean }> {
  const { bomId, businessId, userId, input, existing, finishedProductId } = args

  await prisma.bom.update({
    where: { id: bomId },
    data: { isActive: false, isDefault: false, updatedBy: userId },
  })

  const isDefault = input.isDefault ?? existing.isDefault
  if (isDefault) {
    await prisma.bom.updateMany({
      where: { businessId, productId: finishedProductId, isDefault: true, isDeleted: false },
      data: { isDefault: false },
    })
  }

  const newBom = await prisma.bom.create({
    data: {
      businessId,
      productId: finishedProductId,
      name: input.name ?? existing.name,
      version: existing.version + 1,
      isDefault,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      createdBy: userId,
      components: {
        create: (input.components ?? []).map(c => ({
          componentProductId: c.componentProductId,
          quantity: c.quantity,
          unitId: c.unitId ?? null,
          notes: c.notes ?? null,
        })),
      },
    },
  })

  const detail = (await loadBomDetail(newBom.id, businessId))!
  return { ...detail, versioned: true }
}

// ─── In-place update (BOM has no runs) ───────────────────────────────────────

async function inPlaceUpdate(args: {
  bomId: string
  businessId: string
  userId: string
  input: UpdateBomInput
  existing: { name: string; notes: string | null; isDefault: boolean }
  finishedProductId: string
}): Promise<BomDetailDTO & { versioned: boolean }> {
  const { bomId, businessId, userId, input, existing, finishedProductId } = args

  if (input.isDefault) {
    await prisma.bom.updateMany({
      where: { businessId, productId: finishedProductId, isDefault: true, isDeleted: false, id: { not: bomId } },
      data: { isDefault: false },
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.bomComponent.deleteMany({ where: { bomId } })
    await tx.bom.update({
      where: { id: bomId },
      data: {
        productId: finishedProductId,
        name: input.name ?? existing.name,
        isDefault: input.isDefault ?? existing.isDefault,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        updatedBy: userId,
        components: {
          create: (input.components ?? []).map(c => ({
            componentProductId: c.componentProductId,
            quantity: c.quantity,
            unitId: c.unitId ?? null,
            notes: c.notes ?? null,
          })),
        },
      },
    })
  })

  const detail = (await loadBomDetail(bomId, businessId))!
  return { ...detail, versioned: false }
}

// ─── Soft Delete ──────────────────────────────────────────────────────────────

export async function deleteBom(bomId: string, businessId: string, userId: string): Promise<void> {
  const bom = await prisma.bom.findFirst({
    where: { id: bomId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!bom) throw { code: 'BOM_NOT_FOUND', message: 'BOM not found', status: 404 }

  await prisma.bom.update({
    where: { id: bomId },
    data: { isDeleted: true, isActive: false, isDefault: false, updatedBy: userId },
  })
}
