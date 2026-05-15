/** Sales pipeline — pure utility functions (type→label, lineage→steps). */

import type { DocumentType, DocumentStatus } from '../invoices/invoice.types'
import type { LineageNode, PipelineStep, SalesDocumentType } from './sales.types'
import {
  SALES_TYPE_LABELS,
  SALES_DETAIL_ROUTES,
} from './sales.constants'
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_CODES,
} from '../invoices/invoice.constants'

// ─── Type label helpers ───────────────────────────────────────────────────────

export function getDocumentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type
}

export function getSalesTypeLabel(type: SalesDocumentType): string {
  return SALES_TYPE_LABELS[type] ?? type
}

export function getTypeCode(type: DocumentType): string {
  return DOCUMENT_TYPE_CODES[type] ?? type
}

// ─── Create form page title ───────────────────────────────────────────────────

export function getCreateTitle(type: DocumentType): string {
  switch (type) {
    case 'ESTIMATE':         return 'Create Estimate'
    case 'SALE_ORDER':       return 'Create Sale Order'
    case 'DELIVERY_CHALLAN': return 'Create Delivery Challan'
    case 'SALE_INVOICE':     return 'Create Invoice'
    case 'PURCHASE_INVOICE': return 'Create Purchase Invoice'
    default:                 return 'Create Document'
  }
}

export function getEditTitle(type: DocumentType): string {
  switch (type) {
    case 'ESTIMATE':         return 'Edit Estimate'
    case 'SALE_ORDER':       return 'Edit Sale Order'
    case 'DELIVERY_CHALLAN': return 'Edit Delivery Challan'
    case 'SALE_INVOICE':     return 'Edit Invoice'
    case 'PURCHASE_INVOICE': return 'Edit Purchase Invoice'
    default:                 return 'Edit Document'
  }
}

// ─── Type-specific form feature flags ────────────────────────────────────────

/** Whether the document type shows transport / vehicle fields. */
export function allowsTransportFields(type: DocumentType): boolean {
  return type === 'DELIVERY_CHALLAN' || type === 'SALE_ORDER'
}

/** Whether the document type can record payment (only post-invoice). */
export function allowsPaymentRecord(type: DocumentType): boolean {
  return type === 'SALE_INVOICE' || type === 'PURCHASE_INVOICE'
}

// ─── Lineage → pipeline steps ────────────────────────────────────────────────

/**
 * Convert a lineage chain + self node into ordered PipelineStep[] (root→leaf).
 * Returns empty array if chain has 0 or 1 items (no visual pipeline needed).
 */
export function lineageToPipelineSteps(
  chain: LineageNode[],
  selfId: string,
): PipelineStep[] {
  if (chain.length < 2) return []

  return chain.map((node) => ({
    node,
    isCurrent: node.id === selfId,
  }))
}

// ─── Navigate-to-node route ───────────────────────────────────────────────────

/** Resolve the detail page route for any document type in the lineage. */
export function getNodeRoute(node: LineageNode): string {
  switch (node.type) {
    case 'ESTIMATE':
      return SALES_DETAIL_ROUTES.ESTIMATE(node.id)
    case 'SALE_ORDER':
      return SALES_DETAIL_ROUTES.SALE_ORDER(node.id)
    case 'DELIVERY_CHALLAN':
      return SALES_DETAIL_ROUTES.DELIVERY_CHALLAN(node.id)
    case 'SALE_INVOICE':
      return `/invoices/${node.id}`
    case 'PURCHASE_INVOICE':
      return `/invoices/${node.id}`
    default:
      return `/invoices/${node.id}`
  }
}

// ─── Status display ───────────────────────────────────────────────────────────

export function getStatusVariant(status: DocumentStatus): string {
  switch (status) {
    case 'DRAFT':               return 'badge-info'
    case 'SAVED':               return 'badge-paid'
    case 'SHARED':              return 'badge-pending'
    case 'CONVERTED':           return 'badge-converted'
    case 'DELETED':             return 'badge-error'
    case 'PERMANENTLY_DELETED': return 'badge-error'
    default:                    return 'badge-info'
  }
}
