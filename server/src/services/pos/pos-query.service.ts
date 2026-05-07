/**
 * POS Query Service — list + get
 * listPosSales: cursor-paginated, cashier-scoped (cashier role sees only own sales)
 * getPosSale:  single sale with items + audit events
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { notFoundError } from '../../lib/errors.js'
import type { PosSaleItemDTO, PosSaleDTO } from './pos.types.js'
import type { PosSaleItem, PosSaleEvent, Prisma } from '@prisma/client'

// ─── Context ────────────────────────────────────────────────────────────────

export interface PosQueryCtx {
  businessId: string
  userId: string
  /** Lowercase BusinessUser.role value e.g. 'owner' | 'cashier' | 'staff' */
  role: string
}

// ─── Query input ─────────────────────────────────────────────────────────────

export interface ListPosSalesQuery {
  from?: string        // ISO date string
  to?: string          // ISO date string
  status?: string      // ACTIVE | VOIDED
  cashierId?: string   // filter by cashier userId
  paymentMode?: string // e.g. 'cash' | 'upi' etc.
  cursor?: string      // base64 of { saleDate: string, id: string }
  limit?: number       // default 20, max 100
}

// ─── Return types ────────────────────────────────────────────────────────────

export interface ListPosSalesResult {
  sales: PosSaleDTO[]
  nextCursor: string | null
  totalCount: number
}

// ─── Cursor helpers ──────────────────────────────────────────────────────────

interface CursorPayload {
  saleDate: string
  id: string
}

function encodeCursor(saleDate: Date, id: string): string {
  const payload: CursorPayload = { saleDate: saleDate.toISOString(), id }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

function decodeCursor(encoded: string): CursorPayload | null {
  try {
    const raw = Buffer.from(encoded, 'base64').toString('utf8')
    const parsed = JSON.parse(raw) as CursorPayload
    if (typeof parsed.saleDate !== 'string' || typeof parsed.id !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// ─── Item DTO mapper ─────────────────────────────────────────────────────────

function toItemDTO(item: PosSaleItem): PosSaleItemDTO {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    hsnCode: item.hsnCode,
    unitSymbol: item.unitSymbol,
    quantity: item.quantity,
    ratePaise: item.ratePaise,
    discountType: item.discountType,
    discountValue: item.discountValue,
    discountAmount: item.discountAmount,
    lineTotal: item.lineTotal,
    taxableValue: item.taxableValue,
    cgstRate: item.cgstRate,
    cgstAmount: item.cgstAmount,
    sgstRate: item.sgstRate,
    sgstAmount: item.sgstAmount,
    igstRate: item.igstRate,
    igstAmount: item.igstAmount,
    cessRate: item.cessRate,
    cessAmount: item.cessAmount,
    batchId: item.batchId,
    batchNumber: item.batchNumber,
    godownId: item.godownId,
    note: item.note,
  }
}

// ─── Sale DTO mapper ─────────────────────────────────────────────────────────

type SaleWithItems = Prisma.PosSaleGetPayload<{ include: { items: true } }>

function toSaleDTO(sale: SaleWithItems, warnings: string[] = []): PosSaleDTO {
  return {
    id: sale.id,
    businessId: sale.businessId,
    documentId: sale.documentId,
    receiptNumber: sale.receiptNumber,
    receiptSeq: sale.receiptSeq,
    financialYear: sale.financialYear,
    partyId: sale.partyId,
    walkInName: sale.walkInName,
    walkInPhone: sale.walkInPhone,
    subtotal: Number(sale.subtotal),
    totalDiscount: Number(sale.totalDiscount),
    totalTaxableValue: Number(sale.totalTaxableValue),
    totalCgst: Number(sale.totalCgst),
    totalSgst: Number(sale.totalSgst),
    totalIgst: Number(sale.totalIgst),
    totalCess: Number(sale.totalCess),
    grandTotal: Number(sale.grandTotal),
    taxPricingMode: sale.taxPricingMode,
    placeOfSupply: sale.placeOfSupply,
    supplyType: sale.supplyType,
    paymentBreakdown: sale.paymentBreakdown,
    status: sale.status,
    saleDate: sale.saleDate,
    createdAt: sale.createdAt,
    items: sale.items.map(toItemDTO),
    warnings,
  }
}

// ─── listPosSales ────────────────────────────────────────────────────────────

export async function listPosSales(
  ctx: PosQueryCtx,
  query: ListPosSalesQuery
): Promise<ListPosSalesResult> {
  const { businessId, userId, role } = ctx
  const limit = Math.min(query.limit ?? 20, 100)

  // Cashier scoping: CASHIER role always sees only own sales
  const effectiveCashierId =
    role === 'cashier' ? userId : (query.cashierId ?? undefined)

  const baseWhere: Prisma.PosSaleWhereInput = { businessId }
  if (effectiveCashierId) baseWhere.cashierId = effectiveCashierId
  if (query.status) baseWhere.status = query.status
  if (query.from || query.to) {
    baseWhere.saleDate = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    }
  }

  // Cursor decode
  let finalWhere: Prisma.PosSaleWhereInput = baseWhere
  if (query.cursor) {
    const decoded = decodeCursor(query.cursor)
    if (decoded) {
      const cursorDate = new Date(decoded.saleDate)
      const cursorFilter: Prisma.PosSaleWhereInput = {
        OR: [
          { saleDate: { lt: cursorDate } },
          { saleDate: { equals: cursorDate }, id: { lt: decoded.id } },
        ],
      }
      finalWhere = { AND: [baseWhere, cursorFilter] }
    } else {
      logger.warn('pos-query: invalid cursor provided, ignoring', { cursor: query.cursor })
    }
  }

  // Total count uses base where (without cursor)
  const [totalCount, sales] = await Promise.all([
    prisma.posSale.count({ where: baseWhere }),
    prisma.posSale.findMany({
      where: finalWhere,
      orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    }),
  ])

  const hasMore = sales.length > limit
  const page = hasMore ? sales.slice(0, limit) : sales

  let nextCursor: string | null = null
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1]
    nextCursor = encodeCursor(last.saleDate, last.id)
  }

  logger.info('pos-query: listPosSales', {
    businessId,
    userId,
    role,
    count: page.length,
    totalCount,
    hasMore,
  })

  return {
    sales: page.map(s => toSaleDTO(s, [])),
    nextCursor,
    totalCount,
  }
}

// ─── getPosSale ──────────────────────────────────────────────────────────────

export interface GetPosSaleResult extends PosSaleDTO {
  events: PosSaleEvent[]
}

export async function getPosSale(
  ctx: PosQueryCtx,
  saleId: string
): Promise<GetPosSaleResult> {
  const { businessId, userId, role } = ctx

  const sale = await prisma.posSale.findUnique({
    where: { id: saleId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  })

  // 404 if missing or cross-business — never leak existence
  if (!sale || sale.businessId !== businessId) {
    throw notFoundError('PosSale')
  }

  // Cashier can only see their own sales (prevent existence leakage)
  if (role === 'cashier' && sale.cashierId !== userId) {
    throw notFoundError('PosSale')
  }

  logger.info('pos-query: getPosSale', { businessId, userId, saleId })

  const dto = toSaleDTO(sale, [])
  return { ...dto, events: sale.events }
}
