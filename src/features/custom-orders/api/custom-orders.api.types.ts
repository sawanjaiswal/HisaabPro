/** Custom Orders API — request/response types (mirrors server schemas) */

import type { CustomOrderStatus } from '../custom-orders.types'

export interface CreateCustomOrderItemInput {
  productId?: string | null
  description: string
  spec?: Record<string, unknown> | null
  quantity: string    // decimal as string e.g. "1.000"
  ratePaise: number
  discountPaise?: number
}

export interface CreateCustomOrderInput {
  partyId: string
  title: string
  notes?: string | null
  deliveryAt?: string | null
  deliverySlot?: string | null
  deliveryAddress?: string | null
  discountPaise?: number
  items: CreateCustomOrderItemInput[]
  clientId?: string
}

export type UpdateCustomOrderInput = Partial<Omit<CreateCustomOrderInput, 'clientId'>>

export interface TransitionCustomOrderInput {
  toStatus: Exclude<CustomOrderStatus, 'INVOICED'>
  reason?: string
}

export interface RecordAdvanceInput {
  amountPaise: number
  method: 'cash' | 'upi' | 'bank' | 'cheque' | 'card' | 'other'
  reference?: string | null
  receivedAt?: string
  notes?: string | null
}

export interface ListCustomOrdersQuery {
  status?: CustomOrderStatus
  partyId?: string
  q?: string
  deliveryFrom?: string
  deliveryTo?: string
  hasBalance?: boolean
  cursor?: string
  limit?: number
}
