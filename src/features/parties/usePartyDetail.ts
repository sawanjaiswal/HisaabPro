/** Party Detail — Hook to fetch and manage a single party */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getParty } from './party.service'
import type { PartyDetail } from './party.types'

type DetailStatus = 'loading' | 'error' | 'success'
type DetailTab = 'overview' | 'transactions' | 'addresses'

interface UsePartyDetailReturn {
  party: PartyDetail | null
  status: DetailStatus
  activeTab: DetailTab
  setActiveTab: (tab: DetailTab) => void
  refresh: () => void
}

export function usePartyDetail(id: string): UsePartyDetailReturn {
  const toast = useToast()

  const [party, setParty] = useState<PartyDetail | null>(null)
  const [status, setStatus] = useState<DetailStatus>('loading')
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getParty(id, controller.signal)
      .then((data: PartyDetail) => {
        setParty(data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load party'
        toast.error(message)
      })

    return () => controller.abort()
  }, [id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    party,
    status,
    activeTab,
    setActiveTab,
    refresh,
  }
}
