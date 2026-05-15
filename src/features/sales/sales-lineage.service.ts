/** Sales pipeline — lineage API service (GET only, read-safe to cache). */

import { api } from '@/lib/api'
import type { DocumentLineageResponse } from './sales.types'

/**
 * Fetch the conversion chain for a document (root → leaf, max 6 hops).
 * cacheReads: true — lineage contains only doc numbers/types of own business,
 * safe to cache per session (no cross-tenant data).
 */
export async function getDocumentLineage(
  documentId: string,
  signal?: AbortSignal,
): Promise<DocumentLineageResponse> {
  const response = await api<{ success: boolean; data: DocumentLineageResponse }>(
    `/documents/${documentId}/lineage`,
    { signal, cacheReads: true },
  )
  return response.data
}
