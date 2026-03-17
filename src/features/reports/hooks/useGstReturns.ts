/** GST Returns hook
 *
 * Fetches a specific GST return (GSTR-1, GSTR-3B, or GSTR-9) for a given period.
 * Re-fetches whenever returnType or period changes. Aborts on cleanup.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getGstReturn, exportGstReturn } from '../report.service'
import type {
  GstReturnType,
  Gstr1Data,
  Gstr3bData,
  Gstr9Data,
  GstExportData,
} from '../report-tax.types'

type Status = 'loading' | 'error' | 'success'

interface UseGstReturnsReturn {
  data: Gstr1Data | Gstr3bData | Gstr9Data | null
  status: Status
  returnType: GstReturnType
  period: string
  setReturnType: (type: GstReturnType) => void
  setPeriod: (period: string) => void
  exportJson: () => Promise<GstExportData | null>
  isExporting: boolean
  refresh: () => void
}

function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function useGstReturns(): UseGstReturnsReturn {
  const toast = useToast()

  const [returnType, setReturnType] = useState<GstReturnType>('GSTR1')
  const [period, setPeriod] = useState<string>(getCurrentPeriod)
  const [data, setData] = useState<Gstr1Data | Gstr3bData | Gstr9Data | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [isExporting, setIsExporting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setData(null)

    getGstReturn(returnType, period, controller.signal)
      .then((response) => {
        setData(response)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message =
          err instanceof ApiError ? err.message : 'Failed to load GST return'
        toast.error(message)
      })

    return () => controller.abort()
  }, [returnType, period, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportJson = useCallback(async (): Promise<GstExportData | null> => {
    if (returnType !== 'GSTR1') return null
    setIsExporting(true)
    try {
      const result = await exportGstReturn(returnType, period, 'JSON')
      toast.success('GSTR-1 JSON exported successfully')
      return result
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Export failed. Please try again.'
      toast.error(message)
      return null
    } finally {
      setIsExporting(false)
    }
  }, [returnType, period, toast])

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    data,
    status,
    returnType,
    period,
    setReturnType,
    setPeriod,
    exportJson,
    isExporting,
    refresh,
  }
}
