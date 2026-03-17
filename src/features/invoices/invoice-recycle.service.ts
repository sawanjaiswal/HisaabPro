/** Invoicing — Recycle Bin services
 *
 * Manages soft-deleted documents: list, restore, permanent delete, empty bin.
 * Items are auto-purged 30 days after soft deletion.
 */

import { api } from '@/lib/api'
import type { DocumentListResponse, DocumentDetail, DocumentType } from './invoice.types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecycleBinFilters {
  page?: number
  limit?: number
  /** Optional — filter recycle bin to a specific document type */
  type?: DocumentType
}

export interface EmptyRecycleBinResponse {
  deletedCount: number
}

export interface PermanentDeleteOptions {
  /** Required if the business has PIN protection enabled */
  pin?: string
}

// ─── Query builder helper ────────────────────────────────────────────────────

/**
 * Builds a query string from RecycleBinFilters.
 */
function buildRecycleBinQuery(filters: RecycleBinFilters): string {
  const params = new URLSearchParams()

  const { page, limit, type } = filters

  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  if (type !== undefined) params.set('type', type)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Recycle Bin ─────────────────────────────────────────────────────────────

/**
 * Fetch documents currently in the recycle bin (status = DELETED).
 * Items are auto-purged 30 days after deletion.
 * Same shape as DocumentListResponse but always DELETED status.
 */
export async function getRecycleBin(
  filters: RecycleBinFilters = {},
  signal?: AbortSignal
): Promise<DocumentListResponse> {
  return api<DocumentListResponse>(
    `/documents/recycle-bin${buildRecycleBinQuery(filters)}`,
    { signal }
  )
}

/**
 * Restore a deleted document back to SAVED status.
 * Side effects: stock re-applied, outstanding re-applied, deletedAt cleared.
 * Returns the restored DocumentDetail.
 */
export async function restoreDocument(id: string): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}/restore`, {
    method: 'POST',
  })
}

/**
 * Permanently (hard) delete a single document from the recycle bin.
 * If the business has PIN protection, pass pin in options.
 * Returns void (204 No Content).
 */
export async function permanentDeleteDocument(
  id: string,
  options: PermanentDeleteOptions = {}
): Promise<void> {
  return api<void>(`/documents/${id}/permanent`, {
    method: 'DELETE',
    headers: options.pin ? { 'X-PIN': options.pin } : {},
  })
}

/**
 * Permanently delete ALL documents in the recycle bin (empty bin).
 * If the business has PIN protection, pass pin in options.
 * Returns { deletedCount } (number of documents removed).
 */
export async function emptyRecycleBin(
  options: PermanentDeleteOptions = {}
): Promise<EmptyRecycleBinResponse> {
  return api<EmptyRecycleBinResponse>('/documents/recycle-bin', {
    method: 'DELETE',
    headers: options.pin ? { 'X-PIN': options.pin } : {},
  })
}
