/** Stock Alerts (#49) — data + filter state for the Low Stock page. */

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { matchesFilter, matchesSearch } from './stock-alerts.utils'
import type {
  StockAlertListResponse,
  ExpiryAlertListResponse,
  StockAlertFilter,
} from './stock-alerts.types'

function fetchAlerts(): Promise<StockAlertListResponse> {
  return api<StockAlertListResponse>('/stock-alerts?status=OPEN', { cacheReads: true })
}

function fetchExpiryAlerts(): Promise<ExpiryAlertListResponse> {
  return api<ExpiryAlertListResponse>('/inventory/expiry-alerts?status=ACTIVE', { cacheReads: true })
}

function dismissAlert(id: string): Promise<void> {
  return api<void>(`/stock-alerts/${id}/dismiss`, {
    method: 'POST',
    entityType: 'alert-dismiss',
    entityLabel: 'Alert dismiss',
  })
}

export function useStockAlerts() {
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StockAlertFilter>('ALL')
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const { data, status, refetch } = useQuery({
    queryKey: queryKeys.stockAlerts.list('OPEN'),
    queryFn: fetchAlerts,
  })

  const { data: expiryData, status: expiryStatus } = useQuery({
    queryKey: ['expiry-alerts', 'ACTIVE'],
    queryFn: fetchExpiryAlerts,
  })

  const dismissMutation = useMutation({
    mutationFn: dismissAlert,
    onMutate: (id: string) => setDismissingId(id),
    onSuccess: () => {
      toast.success(t.alertDismissed)
      void queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all() })
    },
    onError: () => toast.error(t.alertDismissFailed),
    onSettled: () => setDismissingId(null),
  })

  // Filtering is client-side: the OPEN alert set is small by construction (it
  // is bounded by how many products are below their minimum), and the chips
  // are a view over one severity field rather than four server states.
  const alerts = useMemo(
    () => (data?.alerts ?? []).filter((a) => matchesFilter(a, filter) && matchesSearch(a, search)),
    [data?.alerts, filter, search],
  )

  return {
    alerts,
    totalCount: data?.alerts.length ?? 0,
    status,
    refetch,
    expiryAlerts: expiryData?.alerts ?? [],
    expiryStatus,
    search,
    setSearch,
    filter,
    setFilter,
    dismissingId,
    dismiss: (id: string) => {
      if (dismissingId) return
      dismissMutation.mutate(id)
    },
  }
}
