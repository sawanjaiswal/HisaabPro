/**
 * Single Source of Truth Navigation Topology & Route Graph
 * Level 6 Axiomatic Navigation: Every route has a deterministic parent,
 * entity category, and ephemeral behavior.
 */

import { ROUTES } from '@/config/routes.config'

export interface RouteMeta {
  parent?: string
  isEphemeral?: boolean
  entityLabel?: string
  fallbackRoot?: string
}

/**
 * Deterministic route hierarchy.
 * When history stack is empty or orphaned (e.g. direct link or push notification),
 * the back engine resolves the parent route from this topology graph.
 */
export const ROUTE_TOPOLOGY: Record<string, RouteMeta> = {
  // Parties
  [ROUTES.PARTIES]: { parent: ROUTES.DASHBOARD, entityLabel: 'Parties' },
  [ROUTES.PARTY_NEW]: { parent: ROUTES.PARTIES, isEphemeral: true, entityLabel: 'New Party' },
  [ROUTES.PARTY_DETAIL]: { parent: ROUTES.PARTIES, entityLabel: 'Party Details' },
  [ROUTES.PARTY_EDIT]: { parent: ROUTES.PARTY_DETAIL, isEphemeral: true, entityLabel: 'Edit Party' },
  [ROUTES.CRM_FOLLOWUPS]: { parent: ROUTES.PARTIES, entityLabel: 'Follow-ups' },

  // Invoices & Sales
  [ROUTES.INVOICES]: { parent: ROUTES.DASHBOARD, entityLabel: 'Invoices' },
  [ROUTES.INVOICE_CREATE]: { parent: ROUTES.INVOICES, isEphemeral: true, entityLabel: 'New Invoice' },
  [ROUTES.INVOICE_DRAFTS]: { parent: ROUTES.INVOICES, entityLabel: 'Draft Invoices' },
  [ROUTES.INVOICE_DETAIL]: { parent: ROUTES.INVOICES, entityLabel: 'Invoice Details' },
  [ROUTES.INVOICE_EDIT]: { parent: ROUTES.INVOICE_DETAIL, isEphemeral: true, entityLabel: 'Edit Invoice' },

  // Payments
  [ROUTES.PAYMENTS]: { parent: ROUTES.DASHBOARD, entityLabel: 'Payments' },
  [ROUTES.PAYMENT_NEW]: { parent: ROUTES.PAYMENTS, isEphemeral: true, entityLabel: 'Record Payment' },
  [ROUTES.PAYMENT_DETAIL]: { parent: ROUTES.PAYMENTS, entityLabel: 'Payment Details' },
  [ROUTES.PAYMENT_EDIT]: { parent: ROUTES.PAYMENT_DETAIL, isEphemeral: true, entityLabel: 'Edit Payment' },
  [ROUTES.OUTSTANDING]: { parent: ROUTES.PAYMENTS, entityLabel: 'Outstanding' },

  // Products & Inventory
  [ROUTES.PRODUCTS]: { parent: ROUTES.DASHBOARD, entityLabel: 'Products' },
  [ROUTES.PRODUCT_NEW]: { parent: ROUTES.PRODUCTS, isEphemeral: true, entityLabel: 'New Product' },
  [ROUTES.PRODUCT_CATEGORIES]: { parent: ROUTES.PRODUCTS, entityLabel: 'Categories' },
  [ROUTES.STOCK_ADJUSTMENTS]: { parent: ROUTES.PRODUCTS, entityLabel: 'Stock Adjustments' },
  [ROUTES.PRODUCT_DETAIL]: { parent: ROUTES.PRODUCTS, entityLabel: 'Product Details' },
  [ROUTES.PRODUCT_EDIT]: { parent: ROUTES.PRODUCT_DETAIL, isEphemeral: true, entityLabel: 'Edit Product' },

  // Purchases & Returns
  [ROUTES.PURCHASES]: { parent: ROUTES.DASHBOARD, entityLabel: 'Purchases' },
  [ROUTES.PURCHASE_NEW]: { parent: ROUTES.PURCHASES, isEphemeral: true, entityLabel: 'New Purchase' },
  [ROUTES.PURCHASE_DETAIL]: { parent: ROUTES.PURCHASES, entityLabel: 'Purchase Details' },
  [ROUTES.PURCHASE_EDIT]: { parent: ROUTES.PURCHASE_DETAIL, isEphemeral: true, entityLabel: 'Edit Purchase' },
  [ROUTES.PURCHASE_RETURNS]: { parent: ROUTES.PURCHASES, entityLabel: 'Purchase Returns' },
  [ROUTES.SALES_RETURNS]: { parent: ROUTES.INVOICES, entityLabel: 'Sales Returns' },

  // Reports
  [ROUTES.REPORTS]: { parent: ROUTES.DASHBOARD, entityLabel: 'Reports' },
  [ROUTES.REPORT_SALES]: { parent: ROUTES.REPORTS, entityLabel: 'Sales Report' },
  [ROUTES.REPORT_PURCHASES]: { parent: ROUTES.REPORTS, entityLabel: 'Purchase Report' },
  [ROUTES.REPORT_DAY_BOOK]: { parent: ROUTES.REPORTS, entityLabel: 'Day Book' },
  [ROUTES.REPORT_PAYMENT_HISTORY]: { parent: ROUTES.REPORTS, entityLabel: 'Payment History' },
  [ROUTES.REPORT_TAX_SUMMARY]: { parent: ROUTES.REPORTS, entityLabel: 'Tax Summary' },
  [ROUTES.REPORT_GST_RETURNS]: { parent: ROUTES.REPORTS, entityLabel: 'GST Returns' },
  [ROUTES.REPORT_PROFIT_LOSS]: { parent: ROUTES.REPORTS, entityLabel: 'Profit & Loss' },
  [ROUTES.REPORT_BALANCE_SHEET]: { parent: ROUTES.REPORTS, entityLabel: 'Balance Sheet' },
  [ROUTES.REPORT_CASH_FLOW]: { parent: ROUTES.REPORTS, entityLabel: 'Cash Flow' },
  [ROUTES.REPORT_AGING]: { parent: ROUTES.REPORTS, entityLabel: 'Aging Report' },

  // Recurring & Jobs
  [ROUTES.RECURRING]: { parent: ROUTES.DASHBOARD, entityLabel: 'Recurring' },
  [ROUTES.RECURRING_NEW]: { parent: ROUTES.RECURRING, isEphemeral: true, entityLabel: 'New Recurring' },
  [ROUTES.RECURRING_DETAIL]: { parent: ROUTES.RECURRING, entityLabel: 'Recurring Details' },
  [ROUTES.RECURRING_EDIT]: { parent: ROUTES.RECURRING_DETAIL, isEphemeral: true, entityLabel: 'Edit Recurring' },
  [ROUTES.JOBS]: { parent: ROUTES.DASHBOARD, entityLabel: 'Jobs' },

  // Settings & System
  [ROUTES.SETTINGS]: { parent: ROUTES.DASHBOARD, entityLabel: 'Settings' },
  [ROUTES.SETTINGS_STAFF]: { parent: ROUTES.SETTINGS, entityLabel: 'Staff Management' },
  [ROUTES.SETTINGS_SECURITY]: { parent: ROUTES.SETTINGS, entityLabel: 'Security' },
  [ROUTES.SETTINGS_BACKUP]: { parent: ROUTES.SETTINGS, entityLabel: 'Backup' },
  [ROUTES.SETTINGS_GST]: { parent: ROUTES.SETTINGS, entityLabel: 'GST Settings' },
  [ROUTES.SETTINGS_SUBSCRIPTION]: { parent: ROUTES.SETTINGS, entityLabel: 'Subscription' },
}

/**
 * Resolves the parent route for any arbitrary path using exact or pattern matching.
 */
export function resolveParentRoute(pathname: string, fallback = ROUTES.DASHBOARD): string {
  // 1. Direct match
  if (ROUTE_TOPOLOGY[pathname]?.parent) {
    return ROUTE_TOPOLOGY[pathname].parent!
  }

  // 2. Pattern match for parameterized routes (e.g., /parties/123/edit -> /parties/123 -> /parties)
  if (/^\/parties\/[^/]+\/edit$/.test(pathname)) {
    return pathname.replace(/\/edit$/, '')
  }
  if (/^\/parties\/[^/]+$/.test(pathname)) {
    return ROUTES.PARTIES
  }
  if (/^\/invoices\/[^/]+\/edit$/.test(pathname)) {
    return pathname.replace(/\/edit$/, '')
  }
  if (/^\/invoices\/[^/]+$/.test(pathname)) {
    return ROUTES.INVOICES
  }
  if (/^\/payments\/[^/]+\/edit$/.test(pathname)) {
    return pathname.replace(/\/edit$/, '')
  }
  if (/^\/payments\/[^/]+$/.test(pathname)) {
    return ROUTES.PAYMENTS
  }
  if (/^\/products\/[^/]+\/edit$/.test(pathname)) {
    return pathname.replace(/\/edit$/, '')
  }
  if (/^\/products\/[^/]+$/.test(pathname)) {
    return ROUTES.PRODUCTS
  }
  if (/^\/purchases\/[^/]+\/edit$/.test(pathname)) {
    return pathname.replace(/\/edit$/, '')
  }
  if (/^\/purchases\/[^/]+$/.test(pathname)) {
    return ROUTES.PURCHASES
  }
  if (/^\/recurring\/[^/]+\/edit$/.test(pathname)) {
    return pathname.replace(/\/edit$/, '')
  }
  if (/^\/recurring\/[^/]+$/.test(pathname)) {
    return ROUTES.RECURRING
  }
  if (/^\/reports\//.test(pathname)) {
    return ROUTES.REPORTS
  }
  if (/^\/settings\//.test(pathname)) {
    return ROUTES.SETTINGS
  }

  return fallback
}
