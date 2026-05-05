/** Custom Orders — Utility functions */

import { STATUS_TRANSITIONS } from './custom-orders.constants'
import type { CustomOrderStatus, CustomOrderItem } from './custom-orders.types'

/** Format an orderNumber or fallback to a short id hint. */
export function formatOrderNumber(orderNumber: string | null, id: string): string {
  if (orderNumber) return orderNumber
  return `#${id.slice(-6).toUpperCase()}`
}

/** Returns allowed next statuses from the given current status. */
export function getNextStatuses(current: CustomOrderStatus): readonly CustomOrderStatus[] {
  return STATUS_TRANSITIONS[current] ?? []
}

/** Returns true if transitioning from → to is valid. */
export function canTransition(from: CustomOrderStatus, to: CustomOrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/** Compute totals from a list of order items (all values in paise). */
export function totalsFromItems(items: Array<{ ratePaise: number; quantity: string; discountPaise: number }>): {
  subtotalPaise: number
  discountPaise: number
  totalPaise: number
} {
  let subtotal = 0
  let discount = 0
  for (const item of items) {
    const qty = parseFloat(item.quantity) || 0
    const lineTotal = Math.round(qty * item.ratePaise)
    subtotal += lineTotal
    discount += item.discountPaise
  }
  return {
    subtotalPaise: subtotal,
    discountPaise: discount,
    totalPaise: Math.max(0, subtotal - discount),
  }
}

/** Format paise as Indian rupee string (e.g. 1,00,000.00). */
export function formatPaise(paise: number): string {
  const rupees = paise / 100
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Compute line-level total from an order item. */
export function itemTotal(item: Pick<CustomOrderItem, 'ratePaise' | 'quantity' | 'discountPaise'>): number {
  const qty = parseFloat(item.quantity) || 0
  return Math.max(0, Math.round(qty * item.ratePaise) - item.discountPaise)
}

/** Render a spec object as a one-line summary string for display. */
export function formatSpecOneLiner(spec: Record<string, unknown> | null): string {
  if (!spec) return ''
  const parts = Object.entries(spec)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        return `${k}: ${Object.entries(v as Record<string, unknown>).map(([sk, sv]) => `${sk}=${sv}`).join(', ')}`
      }
      return `${k}: ${String(v)}`
    })
  return parts.length > 0 ? ` (${parts.join(' · ')})` : ''
}

/** Returns true when the order can be converted to invoice. */
export function canConvertToInvoice(status: CustomOrderStatus, invoiceId: string | null): boolean {
  return !invoiceId && (status === 'READY' || status === 'DELIVERED')
}
