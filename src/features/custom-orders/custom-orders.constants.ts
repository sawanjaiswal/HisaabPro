/** Custom Orders — Constants: statuses, transitions, colours, routes */

import { ROUTES } from '@/config/routes.config'
import type { CustomOrderStatus } from './custom-orders.types'

export const CUSTOM_ORDER_STATUSES: readonly CustomOrderStatus[] = [
  'RECEIVED',
  'IN_PRODUCTION',
  'READY',
  'DELIVERED',
  'INVOICED',
  'CANCELLED',
] as const

/**
 * Client-side mirror of server STATUS_TRANSITIONS table.
 * INVOICED is not reachable here — only via convert-to-invoice endpoint.
 * Must stay in sync with server/src/services/custom-order/helpers.ts.
 */
export const STATUS_TRANSITIONS: Record<CustomOrderStatus, readonly CustomOrderStatus[]> = {
  RECEIVED:      ['IN_PRODUCTION', 'READY', 'CANCELLED'],
  IN_PRODUCTION: ['RECEIVED', 'READY', 'CANCELLED'],
  READY:         ['IN_PRODUCTION', 'DELIVERED', 'CANCELLED'],
  DELIVERED:     ['READY', 'CANCELLED'],
  INVOICED:      [],
  CANCELLED:     [],
}

/** CSS token names for each status pill. Maps to var(--color-*) tokens. */
export const STATUS_COLOUR: Record<CustomOrderStatus, { bg: string; text: string }> = {
  RECEIVED:      { bg: 'var(--color-gray-100)',       text: 'var(--color-gray-700)' },
  IN_PRODUCTION: { bg: 'var(--color-warning-50)',     text: 'var(--color-warning-700)' },
  READY:         { bg: 'var(--color-success-50)',     text: 'var(--color-success-700)' },
  DELIVERED:     { bg: 'var(--color-primary-50)',     text: 'var(--color-primary-700)' },
  INVOICED:      { bg: 'var(--color-secondary-50)',   text: 'var(--color-secondary-700)' },
  CANCELLED:     { bg: 'var(--color-error-50)',       text: 'var(--color-error-700)' },
}

export const ORDER_ROUTES = {
  LIST:   ROUTES.ORDERS,
  NEW:    ROUTES.ORDER_NEW,
  DETAIL: (id: string) => `/orders/${id}`,
  EDIT:   (id: string) => `/orders/${id}/edit`,
} as const

export const ADVANCE_METHODS = ['cash', 'upi', 'bank', 'cheque', 'card', 'other'] as const
export type AdvanceMethod = typeof ADVANCE_METHODS[number]

export const DELIVERY_SLOTS = ['morning', 'afternoon', 'evening'] as const
export type DeliverySlot = typeof DELIVERY_SLOTS[number]
