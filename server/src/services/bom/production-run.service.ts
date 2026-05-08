/**
 * Production Run — list, get, shared detail loader.
 * Execute logic lives in production-run-execute.service.ts.
 */

import { prisma } from '../../lib/prisma.js'
import { Prisma } from '@prisma/client'
import type { ProductionRunDetailDTO, ProductionRunListResult, ProductionRunSummaryDTO } from './production-run.types.js'
import type { ListProductionRunQuery } from '../../schemas/bom/production-run.schemas.js'

// ─── Shared detail loader ─────────────────────────────────────────────────────

export type RunPrismaClient = {
  productionRun: (typeof prisma)['productionRun']
}

export async function loadRunDetail(
  client: RunPrismaClient,
  runId: string
): Promise<ProductionRunDetailDTO> {
  const run = await client.productionRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      bom: { select: { name: true, version: true } },
      finishedProduct: { select: { name: true } },
      createdByUser: { select: { id: true, name: true } },
      components: {
        include: { componentProduct: { select: { name: true } } },
      },
    },
  })

  const totalCostPaise = run.components.reduce(
    (sum, c) => sum + Number(c.costSnapshotPaise) * c.quantityConsumed,
    0
  )
  const perUnitCostPaise = run.quantityProduced > 0
    ? Math.round(totalCostPaise / run.quantityProduced)
    : 0

  return {
    id: run.id,
    bomId: run.bomId,
    bomName: run.bom.name,
    bomVersion: run.bom.version,
    finishedProductId: run.finishedProductId,
    finishedProductName: run.finishedProduct.name,
    quantityProduced: run.quantityProduced,
    runDate: run.runDate.toISOString(),
    status: run.status,
    totalCostPaise: Math.round(totalCostPaise),
    perUnitCostPaise,
    createdAt: run.createdAt.toISOString(),
    notes: run.notes,
    warnings: Array.isArray(run.warnings) ? (run.warnings as string[]) : [],
    components: run.components.map(c => ({
      componentProductId: c.componentProductId,
      componentProductName: c.componentProduct.name,
      quantityConsumed: c.quantityConsumed,
      costSnapshotPaise: Number(c.costSnapshotPaise),
      lineTotalPaise: Math.round(Number(c.costSnapshotPaise) * c.quantityConsumed),
    })),
    createdBy: run.createdBy,
    createdByName: run.createdByUser?.name ?? '',
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listProductionRuns(
  businessId: string,
  query: ListProductionRunQuery
): Promise<ProductionRunListResult> {
  const { bomId, from, to, status, page, limit } = query
  const skip = (page - 1) * limit
  const where: Prisma.ProductionRunWhereInput = {
    businessId,
    isDeleted: false,
    ...(bomId ? { bomId } : {}),
    ...(status ? { status } : {}),
    ...(from || to ? {
      runDate: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    } : {}),
  }

  const [total, runs] = await Promise.all([
    prisma.productionRun.count({ where }),
    prisma.productionRun.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        bom: { select: { name: true, version: true } },
        finishedProduct: { select: { name: true } },
        components: { select: { costSnapshotPaise: true, quantityConsumed: true } },
      },
    }),
  ])

  const data: ProductionRunSummaryDTO[] = runs.map(r => {
    const totalCost = r.components.reduce(
      (s, c) => s + Number(c.costSnapshotPaise) * c.quantityConsumed, 0
    )
    return {
      id: r.id,
      bomId: r.bomId,
      bomName: r.bom.name,
      bomVersion: r.bom.version,
      finishedProductId: r.finishedProductId,
      finishedProductName: r.finishedProduct.name,
      quantityProduced: r.quantityProduced,
      runDate: r.runDate.toISOString(),
      status: r.status,
      totalCostPaise: Math.round(totalCost),
      perUnitCostPaise: r.quantityProduced > 0 ? Math.round(totalCost / r.quantityProduced) : 0,
      createdAt: r.createdAt.toISOString(),
    }
  })

  return { data, pagination: { page, limit, total, hasMore: skip + limit < total } }
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getProductionRun(
  runId: string,
  businessId: string
): Promise<ProductionRunDetailDTO> {
  const run = await prisma.productionRun.findFirst({
    where: { id: runId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!run) throw { code: 'RUN_NOT_FOUND', message: 'Production run not found', status: 404 }
  return loadRunDetail(prisma, runId)
}
