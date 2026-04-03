/** GST Returns hook (TanStack Query)
 *
 * Fetches a specific GST return (GSTR-1, GSTR-3B, or GSTR-9) for a given period.
 * Re-fetches whenever returnType or period changes. Aborts via TanStack Query.
 */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const [returnType, setReturnType] = useState<GstReturnType>('GSTR1')
  const [period, setPeriod] = useState<string>(getCurrentPeriod)

  const query = useQuery({
    queryKey: queryKeys.reports.gstReturns({ returnType, period }),
    queryFn: ({ signal }) => getGstReturn(returnType, period, signal),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load GST return')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportMutation = useMutation({
    mutationFn: () => exportGstReturn(returnType, period, 'JSON'),
    onSuccess: () => {
      toast.success('GSTR-1 JSON exported successfully')
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Export failed. Please try again.')
    },
  })

  const exportJson = useCallback(async (): Promise<GstExportData | null> => {
    if (returnType !== 'GSTR1') return null
    try {
      return await exportMutation.mutateAsync()
    } catch {
      return null
    }
  }, [returnType, exportMutation])

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.gstReturns({ returnType, period }) })
  }, [queryClient, returnType, period])

  return {
    data: query.data ?? null,
    status,
    returnType,
    period,
    setReturnType,
    setPeriod,
    exportJson,
    isExporting: exportMutation.isPending,
    refresh,
  }
}
