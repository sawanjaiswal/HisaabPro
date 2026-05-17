/** POS — API wrappers (all via api() — no raw fetch) */

import { api } from '@/lib/api'
import { generateIdempotencyKey } from '../utils/pos.utils'
import type {
  PosSaleDTO,
  PosListResponse,
  PosProductsResponse,
  PaymentSplit,
  PaymentMode,
  PosCartItem,
  PosHistoryFilters,
  ShareReceiptResponse,
} from '../types/pos.types'

// ─── Create sale ─────────────────────────────────────────────────────────────

export interface CreateSalePayload {
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    discount?: number
  }>
  payments: PaymentSplit[]
  partyId?: string
  idempotencyKey: string
  clientId?: string
  walkInName?: string
  walkInPhone?: string
}

export function buildCreateSalePayload(
  cartItems: PosCartItem[],
  payments: PaymentSplit[],
  partyId?: string,
  walkInName?: string,
  walkInPhone?: string,
): CreateSalePayload {
  return {
    idempotencyKey: generateIdempotencyKey(),
    items: cartItems.map((i) => ({
      productId: i.productId,
      quantity:  i.quantity,
      unitPrice: i.unitPrice,
      ...(i.discount > 0 ? { discount: i.discount } : {}),
    })),
    payments: payments.map((p) => {
      // Loyalty splits must use the lowercase wire-mode + `pointsRedeemed`
      // (server validator: pos.validators.ts paymentModeSchema + posPaymentSchema).
      if (p.mode === 'LOYALTY_REDEMPTION') {
        return {
          mode: 'loyalty_redemption' as PaymentMode,
          amount: p.amount,
          ...(p.referenceNumber ? { referenceNumber: p.referenceNumber } : {}),
          ...(p.pointsRedeemed ? { pointsRedeemed: p.pointsRedeemed } : {}),
        }
      }
      return {
        mode: p.mode,
        amount: p.amount,
        ...(p.referenceNumber ? { referenceNumber: p.referenceNumber } : {}),
      }
    }),
    partyId,
    walkInName,
    walkInPhone,
  }
}

export async function createSale(
  payload: CreateSalePayload,
  receiptLabel: string,
): Promise<PosSaleDTO> {
  return api<PosSaleDTO>('/pos/sales', {
    method: 'POST',
    body:   JSON.stringify(payload),
    headers: { 'X-Idempotency-Key': payload.idempotencyKey },
    entityType:  'pos_sale',
    entityLabel: receiptLabel,
  })
}

// ─── List sales ──────────────────────────────────────────────────────────────

export async function listSales(filters: Partial<PosHistoryFilters>): Promise<PosListResponse> {
  const params = new URLSearchParams()
  if (filters.cursor)       params.set('cursor',       filters.cursor)
  if (filters.limit)        params.set('limit',        String(filters.limit))
  if (filters.from)         params.set('from',         filters.from)
  if (filters.to)           params.set('to',           filters.to)
  if (filters.status)       params.set('status',       filters.status)
  if (filters.cashierId)    params.set('cashierId',    filters.cashierId)
  if (filters.paymentMode)  params.set('paymentMode',  filters.paymentMode)
  const qs = params.toString()
  return api<PosListResponse>(`/pos/sales${qs ? `?${qs}` : ''}`, { cacheReads: false })
}

// ─── Get single sale ─────────────────────────────────────────────────────────

export async function getSale(id: string): Promise<PosSaleDTO> {
  return api<PosSaleDTO>(`/pos/sales/${id}`, { cacheReads: false })
}

// ─── Void sale ───────────────────────────────────────────────────────────────

export async function voidSale(id: string, reason: string, label: string): Promise<PosSaleDTO> {
  return api<PosSaleDTO>(`/pos/sales/${id}/void`, {
    method:      'POST',
    body:        JSON.stringify({ reason }),
    entityType:  'pos_sale',
    entityLabel: label,
  })
}

// ─── Restore sale ────────────────────────────────────────────────────────────

export async function restoreSale(id: string, label: string): Promise<PosSaleDTO> {
  return api<PosSaleDTO>(`/pos/sales/${id}/restore`, {
    method:      'POST',
    body:        JSON.stringify({}),
    entityType:  'pos_sale',
    entityLabel: label,
  })
}

// ─── List products ───────────────────────────────────────────────────────────

export interface ListProductsParams {
  search?:            string
  categoryId?:        string
  limit?:             number
  cursor?:            string
  includeOutOfStock?: boolean
}

export async function listPosProducts(params: ListProductsParams): Promise<PosProductsResponse> {
  const p = new URLSearchParams()
  if (params.search)                         p.set('search',            params.search)
  if (params.categoryId)                     p.set('categoryId',        params.categoryId)
  if (params.limit)                          p.set('limit',             String(params.limit))
  if (params.cursor)                         p.set('cursor',            params.cursor)
  if (params.includeOutOfStock !== undefined) p.set('includeOutOfStock', String(params.includeOutOfStock))
  const qs = p.toString()
  return api<PosProductsResponse>(`/pos/products${qs ? `?${qs}` : ''}`, { cacheReads: true })
}

// ─── Share receipt ───────────────────────────────────────────────────────────

export async function shareReceipt(
  saleId: string,
  channel: 'WHATSAPP' | 'EMAIL',
  label: string,
): Promise<ShareReceiptResponse> {
  return api<ShareReceiptResponse>(`/pos/receipt/${saleId}/share`, {
    method:      'POST',
    body:        JSON.stringify({ channel }),
    entityType:  'pos_sale',
    entityLabel: label,
  })
}
