/** Custom Orders — Type definitions (mirrors backend selects & schemas) */

export type CustomOrderStatus =
  | 'RECEIVED'
  | 'IN_PRODUCTION'
  | 'READY'
  | 'DELIVERED'
  | 'INVOICED'
  | 'CANCELLED'

export interface CustomOrderItem {
  id: string
  sortOrder: number
  productId: string | null
  description: string
  spec: Record<string, unknown> | null
  quantity: string // Decimal serialised as string
  ratePaise: number
  discountPaise: number
  totalPaise: number
}

export interface CustomOrderAdvance {
  id: string
  amountPaise: number
  method: 'cash' | 'upi' | 'bank' | 'cheque' | 'card' | 'other'
  reference: string | null
  receivedAt: string
  notes: string | null
  paymentId: string | null
}

export interface CustomOrderListRow {
  id: string
  orderNumber: string | null
  title: string
  status: CustomOrderStatus
  partyId: string
  partyName: string
  deliveryAt: string | null
  deliverySlot: string | null
  totalPaise: number
  advancePaise: number
  balancePaise: number
  invoiceId: string | null
  updatedAt: string
}

export interface CustomOrderDetail extends CustomOrderListRow {
  notes: string | null
  deliveryAddress: string | null
  subtotalPaise: number
  discountPaise: number
  productionStartedAt: string | null
  readyAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  items: CustomOrderItem[]
  advances: CustomOrderAdvance[]
  createdAt: string
  createdBy: string
}

export interface CustomOrderListResponse {
  items: CustomOrderListRow[]
  nextCursor: string | null
}
