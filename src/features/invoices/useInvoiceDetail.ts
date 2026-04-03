/** Invoice Detail — Hook to fetch and manage a single document
 *
 * TanStack Query v5 migration. Fetches full DocumentDetail by ID,
 * manages tab state. Query replaces useState + useEffect + refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getDocument } from './invoice.service'
import type { DocumentDetail } from './invoice.types'
import type { DetailTab } from './invoice.constants'

type DetailStatus = 'loading' | 'error' | 'success'

interface UseInvoiceDetailReturn {
  document: DocumentDetail | null
  status: DetailStatus
  activeTab: DetailTab
  setActiveTab: (tab: DetailTab) => void
  refresh: () => void
}

export function useInvoiceDetail(id: string): UseInvoiceDetailReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')

  // TanStack Query replaces useState(document) + useEffect(fetch) + refreshKey
  const query = useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: ({ signal }) => getDocument(id, signal),
  })

  const document = query.data ?? null
  const status: DetailStatus = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load invoice'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) })
  }, [queryClient, id])

  return {
    document,
    status,
    activeTab,
    setActiveTab,
    refresh,
  }
}
