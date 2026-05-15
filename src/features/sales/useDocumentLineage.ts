/** Sales pipeline — lineage query hook (TanStack Query wrapper). */

import { useQuery } from '@tanstack/react-query'
import { getDocumentLineage } from './sales-lineage.service'
import { lineageToPipelineSteps } from './sales.utils'
import type { PipelineStep, DocumentLineageResponse } from './sales.types'

interface UseDocumentLineageReturn {
  lineage: DocumentLineageResponse | null
  steps: PipelineStep[]
  isLoading: boolean
  isError: boolean
}

/**
 * Fetches the conversion chain for a document.
 * Enabled only when documentId is non-empty.
 * Errors are silently swallowed — timeline widget hides on error per spec.
 */
export function useDocumentLineage(documentId: string): UseDocumentLineageReturn {
  const query = useQuery({
    queryKey: ['document-lineage', documentId],
    queryFn: ({ signal }) => getDocumentLineage(documentId, signal),
    enabled: Boolean(documentId),
    retry: false, // timeline is non-critical; don't retry on error
  })

  const lineage = query.data ?? null
  const steps = lineage
    ? lineageToPipelineSteps(lineage.chain, documentId)
    : []

  return {
    lineage,
    steps,
    isLoading: query.isPending,
    isError: query.isError,
  }
}
