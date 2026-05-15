/** Sales pipeline — shared types (Estimate / Sale Order / Delivery Challan). */

import type { DocumentType, DocumentStatus } from '../invoices/invoice.types'

// ─── Sales-pipeline document types ───────────────────────────────────────────
// Subset of DocumentType used in the Sales hub.

export type SalesDocumentType =
  | 'ESTIMATE'
  | 'SALE_ORDER'
  | 'DELIVERY_CHALLAN'

// ─── Lineage chain node ───────────────────────────────────────────────────────

export interface LineageNode {
  id: string
  type: DocumentType
  number: string
  status: DocumentStatus
  documentDate: string
}

// ─── Lineage API response ─────────────────────────────────────────────────────

export interface DocumentLineageResponse {
  source: LineageNode | null
  self: LineageNode
  convertedTo: LineageNode | null
  chain: LineageNode[]
  truncated?: boolean
}

// ─── Pipeline timeline step ───────────────────────────────────────────────────

export interface PipelineStep {
  node: LineageNode
  isCurrent: boolean
}

// ─── Document list query params (mirrors DocumentFilters shape for sales pages) ─

export interface SalesDocumentFilters {
  type: SalesDocumentType
  page: number
  limit: number
  sortBy: 'documentDate' | 'createdAt' | 'grandTotal' | 'documentNumber'
  sortOrder: 'asc' | 'desc'
  search?: string
  status?: string
  partyId?: string
  fromDate?: string
  toDate?: string
}

// ─── Filter bar active state ──────────────────────────────────────────────────

export interface SalesFilterState {
  search: string
  status: DocumentStatus | 'ALL'
  fromDate: string
  toDate: string
}
