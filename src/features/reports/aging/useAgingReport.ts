/** Aging report — fetch, abort, retry.
 *
 * Lifted off `AgingReportPage` so the page is composition only. The dataset
 * switch (receivable ↔ payable) is a refetch, the chip and search filters are
 * not — those stay client-side in the page so they work offline.
 */

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { getAgingReport } from '../finance.service'
import type { AgingReportData, AgingType } from '../finance.types'

type FetchStatus = 'loading' | 'error' | 'success'

export function useAgingReport(agingType: AgingType) {
  const { t } = useLanguage()
  const toast = useToast()
  const [data, setData] = useState<AgingReportData | null>(null)
  const [status, setStatus] = useState<FetchStatus>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getAgingReport(agingType, controller.signal)
      .then((next) => {
        setData(next)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.failedLoadAging)
      })
    return () => controller.abort()
  }, [agingType, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

  return { data, status, refresh }
}
