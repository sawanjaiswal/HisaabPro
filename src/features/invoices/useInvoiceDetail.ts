/** Invoice Detail — Hook to fetch and manage a single document
 *
 * Mirrors useProductDetail.ts exactly. Fetches full DocumentDetail by ID,
 * manages tab state, and supports manual refresh via refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getDocument } from './invoice.service'
import type { DocumentDetail } from './invoice.types'

type DetailStatus = 'loading' | 'error' | 'success'
type DetailTab = 'overview' | 'items' | 'share'

interface UseInvoiceDetailReturn {
  document: DocumentDetail | null
  status: DetailStatus
  activeTab: DetailTab
  setActiveTab: (tab: DetailTab) => void
  refresh: () => void
}

export function useInvoiceDetail(id: string): UseInvoiceDetailReturn {
  const toast = useToast()

  const [document, setDocument] = useState<DocumentDetail | null>(null)
  const [status, setStatus] = useState<DetailStatus>('loading')
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getDocument(id, controller.signal)
      .then((data: DocumentDetail) => {
        setDocument(data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load invoice'
        toast.error(message)
      })

    return () => controller.abort()
  }, [id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    document,
    status,
    activeTab,
    setActiveTab,
    refresh,
  }
}
