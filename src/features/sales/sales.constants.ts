/** Sales pipeline — label maps, route paths, type config (pure data). */

import type { SalesDocumentType } from './sales.types'

// ─── Route paths for sales hub ────────────────────────────────────────────────

export const SALES_ROUTES = {
  HUB:                 '/sales',
  ESTIMATES:           '/sales/estimates',
  ESTIMATE_NEW:        '/sales/estimates/new',
  ESTIMATE_DETAIL:     '/sales/estimates/:id',
  ESTIMATE_EDIT:       '/sales/estimates/:id/edit',
  SALE_ORDERS:         '/sales/orders',
  SALE_ORDER_NEW:      '/sales/orders/new',
  SALE_ORDER_DETAIL:   '/sales/orders/:id',
  SALE_ORDER_EDIT:     '/sales/orders/:id/edit',
  DELIVERY_CHALLANS:   '/sales/challans',
  CHALLAN_NEW:         '/sales/challans/new',
  CHALLAN_DETAIL:      '/sales/challans/:id',
  CHALLAN_EDIT:        '/sales/challans/:id/edit',
} as const

// ─── Hub tab order ────────────────────────────────────────────────────────────

export type SalesHubTab = 'invoices' | 'estimates' | 'orders' | 'challans'

export const SALES_HUB_TABS: { id: SalesHubTab; label: string; route: string }[] = [
  { id: 'invoices',   label: 'Invoices',           route: SALES_ROUTES.HUB },
  { id: 'estimates',  label: 'Estimates',           route: SALES_ROUTES.ESTIMATES },
  { id: 'orders',     label: 'Sale Orders',         route: SALES_ROUTES.SALE_ORDERS },
  { id: 'challans',   label: 'Delivery Challans',   route: SALES_ROUTES.DELIVERY_CHALLANS },
]

// ─── Label maps per sales doc type ───────────────────────────────────────────

export const SALES_TYPE_LABELS: Record<SalesDocumentType, string> = {
  ESTIMATE:         'Estimate',
  SALE_ORDER:       'Sale Order',
  DELIVERY_CHALLAN: 'Delivery Challan',
}

export const SALES_TYPE_SHORT: Record<SalesDocumentType, string> = {
  ESTIMATE:         'EST',
  SALE_ORDER:       'SO',
  DELIVERY_CHALLAN: 'DC',
}

// ─── Create CTA labels ────────────────────────────────────────────────────────

export const SALES_CREATE_LABELS: Record<SalesDocumentType, string> = {
  ESTIMATE:         'New Estimate',
  SALE_ORDER:       'New Sale Order',
  DELIVERY_CHALLAN: 'New Challan',
}

// ─── Create routes ────────────────────────────────────────────────────────────

export const SALES_CREATE_ROUTES: Record<SalesDocumentType, string> = {
  ESTIMATE:         SALES_ROUTES.ESTIMATE_NEW,
  SALE_ORDER:       SALES_ROUTES.SALE_ORDER_NEW,
  DELIVERY_CHALLAN: SALES_ROUTES.CHALLAN_NEW,
}

// ─── Detail route builders ────────────────────────────────────────────────────

export const SALES_DETAIL_ROUTES: Record<SalesDocumentType, (id: string) => string> = {
  ESTIMATE:         (id) => `/sales/estimates/${id}`,
  SALE_ORDER:       (id) => `/sales/orders/${id}`,
  DELIVERY_CHALLAN: (id) => `/sales/challans/${id}`,
}
